import { In, IsNull } from 'typeorm';

import { AppDataSource } from '../../../infrastructure/database/data-source.js';
import { Enrollment } from '../../enrollment/infrastructure/persistence/typeorm/entities/enrollment.entity.js';
import { Student } from '../../enrollment/infrastructure/persistence/typeorm/entities/student.entity.js';
import { TopicBotConfig } from '../infrastructure/persistence/typeorm/entities/topic-bot-config.entity.js';
import { Topic } from '../infrastructure/persistence/typeorm/entities/topic.entity.js';
import { TopicProblem } from '../infrastructure/persistence/typeorm/entities/topic-problem.entity.js';
import { TopicStanding } from '../infrastructure/persistence/typeorm/entities/topic-standing.entity.js';
import {
  CodeforcesClient,
  extractGymIdFromLink,
  resolveCodeforcesCredentials,
  type CodeforcesCredentials,
} from '../../../infrastructure/external/codeforces/codeforces-api.service.js';
import type { IntervalJob } from '../../../infrastructure/jobs/index.js';

type ContestListItem = {
  id?: number;
  name?: string;
};

async function buildCodeforcesCredentialsByTeacherId(
  teacherIds: number[],
): Promise<Map<number, CodeforcesCredentials | null>> {
  if (teacherIds.length === 0) {
    return new Map<number, CodeforcesCredentials | null>();
  }

  const configs = await AppDataSource.getRepository(TopicBotConfig).findBy({
    teacher_id: In(teacherIds),
  });
  const configByTeacherId = new Map(configs.map((config) => [config.teacher_id, config]));
  const map = new Map<number, CodeforcesCredentials | null>();

  for (const teacherId of teacherIds) {
    const config = configByTeacherId.get(teacherId) ?? null;
    const hasApiKey = typeof config?.codeforces_api_key === 'string' && config.codeforces_api_key.trim().length > 0;
    const hasApiSecret = typeof config?.codeforces_api_secret === 'string'
      && config.codeforces_api_secret.trim().length > 0;

    if (hasApiKey !== hasApiSecret) {
      console.warn(`[codeforces-topic-sync] teacher ${teacherId} has partial Codeforces credentials; using public API fallback`);
    }

    map.set(teacherId, resolveCodeforcesCredentials(config?.codeforces_api_key, config?.codeforces_api_secret));
  }

  return map;
}

async function fetchCodeforcesGymMetadataSafely(
  codeforces: CodeforcesClient,
): Promise<Map<string, { gym_id: string; title: string }> | null> {
  try {
    const gyms = await codeforces.call<ContestListItem[]>('contest.list', { gym: true });
    return new Map(
      gyms
        .filter((gym) => gym.id && typeof gym.name === 'string' && gym.name.trim().length > 0)
        .map((gym) => [
          String(gym.id),
          {
            gym_id: String(gym.id),
            title: gym.name!.trim(),
          },
        ]),
    );
  } catch {
    return null;
  }
}

function buildCredentialsCacheKey(credentials: CodeforcesCredentials | null): string {
  return credentials ? `${credentials.apiKey}\0${credentials.apiSecret}` : 'public';
}

async function fetchCodeforcesGymStandingsSafely(
  gymId: string,
  codeforces: CodeforcesClient,
): Promise<Awaited<ReturnType<CodeforcesClient['fetchGymStandings']>> | null> {
  try {
    return await codeforces.fetchGymStandings(gymId);
  } catch (error) {
    console.warn(`[codeforces-topic-sync] failed to sync standings for gym ${gymId}`, error);
    return null;
  }
}

function shouldPullTopicStanding(topic: Topic, now: Date, standingIntervalMs: number): boolean {
  if (topic.closed_at) {
    return false;
  }

  if (!topic.last_pulled_at) {
    return true;
  }

  return now.getTime() - topic.last_pulled_at.getTime() >= standingIntervalMs;
}

async function syncTopicStanding(
  topic: Topic,
  codeforces: CodeforcesClient,
  now: Date,
): Promise<boolean> {
  const gymId = topic.gym_id ?? extractGymIdFromLink(topic.gym_link);
  if (!gymId) {
    return false;
  }

  const standings = await fetchCodeforcesGymStandingsSafely(gymId, codeforces);
  if (!standings) {
    return false;
  }

  await AppDataSource.transaction(async (manager) => {
    const topicRepo = manager.getRepository(Topic);
    const problemRepo = manager.getRepository(TopicProblem);
    const standingRepo = manager.getRepository(TopicStanding);

    topic.gym_id = standings.gym_id;
    topic.title = standings.title;
    topic.last_pulled_at = now;
    await topicRepo.save(topic);

    const existingProblems = await problemRepo.findBy({
      teacher_id: topic.teacher_id,
      topic_id: topic.id,
    });
    const problemByIndex = new Map(existingProblems.map((problem) => [problem.problem_index, problem]));
    const syncedProblemIndexes = new Set(standings.problems.map((problem) => problem.index));
    const staleProblemIds = existingProblems
      .filter((problem) => !syncedProblemIndexes.has(problem.problem_index))
      .map((problem) => problem.id);

    if (staleProblemIds.length > 0) {
      await standingRepo.delete({
        teacher_id: topic.teacher_id,
        topic_id: topic.id,
        problem_id: In(staleProblemIds),
      });
      await problemRepo.delete({
        teacher_id: topic.teacher_id,
        topic_id: topic.id,
        id: In(staleProblemIds),
      });
    }

    const syncedProblems: TopicProblem[] = [];

    for (const problemInput of standings.problems) {
      const existing = problemByIndex.get(problemInput.index);
      if (existing) {
        existing.problem_name = problemInput.name;
        syncedProblems.push(existing);
        continue;
      }

      syncedProblems.push(problemRepo.create({
        teacher_id: topic.teacher_id,
        topic_id: topic.id,
        problem_index: problemInput.index,
        problem_name: problemInput.name,
      }));
    }

    const savedProblems = syncedProblems.length > 0 ? await problemRepo.save(syncedProblems) : [];
    const savedProblemByIndex = new Map(savedProblems.map((problem) => [problem.problem_index, problem]));

    const enrollments = await manager.getRepository(Enrollment).findBy({
      teacher_id: topic.teacher_id,
      class_id: topic.class_id,
      unenrolled_at: IsNull(),
    });
    const studentIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.student_id)));
    const students = studentIds.length > 0
      ? await manager.getRepository(Student).findBy({
        teacher_id: topic.teacher_id,
        id: In(studentIds),
      })
      : [];

    const studentByHandle = new Map<string, Student>();
    students.forEach((student) => {
      const handle = student.codeforces_handle?.trim().toLowerCase();
      if (handle) {
        studentByHandle.set(handle, student);
      }
    });

    const resultByStudentProblem = new Map<string, { solved: boolean; penalty_minutes: number | null }>();
    standings.rows.forEach((row) => {
      const student = row.handles
        .map((handle) => studentByHandle.get(handle.trim().toLowerCase()))
        .find(Boolean);
      if (!student) {
        return;
      }

      standings.problems.forEach((problemInput, index) => {
        const problem = savedProblemByIndex.get(problemInput.index);
        if (!problem) {
          return;
        }

        const result = row.problemResults[index];
        resultByStudentProblem.set(`${student.id}:${problem.id}`, {
          solved: result?.solved ?? false,
          penalty_minutes: result?.penalty_minutes ?? null,
        });
      });
    });

    const existingStandings = await standingRepo.findBy({
      teacher_id: topic.teacher_id,
      topic_id: topic.id,
    });
    const standingByStudentProblem = new Map(
      existingStandings.map((standing) => [`${standing.student_id}:${standing.problem_id}`, standing]),
    );

    const nextStandings: TopicStanding[] = [];
    for (const student of students) {
      for (const problem of savedProblems) {
        const key = `${student.id}:${problem.id}`;
        const result = resultByStudentProblem.get(key) ?? { solved: false, penalty_minutes: null };
        const existing = standingByStudentProblem.get(key);

        if (existing) {
          existing.solved = result.solved;
          existing.penalty_minutes = result.penalty_minutes;
          existing.pulled_at = now;
          nextStandings.push(existing);
          continue;
        }

        nextStandings.push(standingRepo.create({
          teacher_id: topic.teacher_id,
          topic_id: topic.id,
          student_id: student.id,
          problem_id: problem.id,
          solved: result.solved,
          penalty_minutes: result.penalty_minutes,
          pulled_at: now,
        }));
      }
    }

    if (nextStandings.length > 0) {
      await standingRepo.save(nextStandings);
    }
  });

  return true;
}

export async function syncCodeforcesTopicsOnce(options: {
  standingIntervalMs: number;
}): Promise<void> {
  if (!AppDataSource.isInitialized) {
    return;
  }

  const repo = AppDataSource.getRepository(Topic);
  const topics = await repo.find();
  const dirty: Topic[] = [];
  let standingSyncCount = 0;
  const now = new Date();

  const teacherIds = Array.from(new Set(topics.map((topic) => topic.teacher_id)));
  const credentialsByTeacherId = await buildCodeforcesCredentialsByTeacherId(teacherIds);
  const gymMetadataByCredentials = new Map<string, Map<string, { gym_id: string; title: string }> | null>();

  for (const topic of topics) {
    const gymId = topic.gym_id ?? extractGymIdFromLink(topic.gym_link);
    if (!gymId) {
      continue;
    }

    const credentials = credentialsByTeacherId.get(topic.teacher_id) ?? null;
    const codeforces = new CodeforcesClient(credentials);
    const credentialsCacheKey = buildCredentialsCacheKey(credentials);
    let gymMetadataById = gymMetadataByCredentials.get(credentialsCacheKey);

    if (!gymMetadataByCredentials.has(credentialsCacheKey)) {
      gymMetadataById = await fetchCodeforcesGymMetadataSafely(codeforces);
      gymMetadataByCredentials.set(credentialsCacheKey, gymMetadataById);
    }

    const synced = gymMetadataById?.get(gymId) ?? null;
    if (!synced) {
      continue;
    }

    if (topic.gym_id === synced.gym_id && topic.title === synced.title) {
      if (
        shouldPullTopicStanding(topic, now, options.standingIntervalMs)
        && await syncTopicStanding(topic, codeforces, now)
      ) {
        standingSyncCount += 1;
      }
      continue;
    }

    topic.gym_id = synced.gym_id;
    topic.title = synced.title;
    dirty.push(topic);

    if (
      shouldPullTopicStanding(topic, now, options.standingIntervalMs)
      && await syncTopicStanding(topic, codeforces, now)
    ) {
      standingSyncCount += 1;
    }
  }

  if (dirty.length > 0) {
    await repo.save(dirty);
    console.log(`[codeforces-topic-sync] topics updated: ${dirty.length}`);
  }

  if (standingSyncCount > 0) {
    console.log(`[codeforces-topic-sync] standings synced: ${standingSyncCount}`);
  }
}

export function createCodeforcesTopicSyncJob(options: {
  enabled: boolean;
  intervalSeconds: number;
  standingIntervalSeconds: number;
}): IntervalJob {
  return {
    name: 'codeforces-topic-sync',
    enabled: options.enabled,
    intervalMs: Math.max(1, options.intervalSeconds) * 1000,
    run: () => syncCodeforcesTopicsOnce({
      standingIntervalMs: Math.max(1, options.standingIntervalSeconds) * 1000,
    }),
  };
}
