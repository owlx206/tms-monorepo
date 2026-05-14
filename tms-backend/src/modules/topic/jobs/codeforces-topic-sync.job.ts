import { In, IsNull } from 'typeorm';

import { AppDataSource } from '../../../infrastructure/database/data-source.js';
import { Enrollment, Student, Teacher, Topic, TopicProblem, TopicStanding } from '../../../entities/index.js';
import {
  CodeforcesClient,
  extractGymIdFromLink,
  resolveCodeforcesCredentials,
  type CodeforcesCredentials,
} from '../../../infrastructure/external/codeforces/codeforces-api.service.js';
import type { IntervalJob } from '../../../jobs/index.js';

const CODEFORCES_STANDING_SYNC_INTERVAL_MS = 15 * 1000;

function hasPartialCodeforcesCredentials(teacher: Teacher): boolean {
  const hasApiKey = typeof teacher.codeforces_api_key === 'string' && teacher.codeforces_api_key.trim().length > 0;
  const hasApiSecret = typeof teacher.codeforces_api_secret === 'string'
    && teacher.codeforces_api_secret.trim().length > 0;

  return hasApiKey !== hasApiSecret;
}

async function buildCodeforcesCredentialsByTeacherId(
  teacherIds: number[],
): Promise<Map<number, CodeforcesCredentials | null>> {
  if (teacherIds.length === 0) {
    return new Map<number, CodeforcesCredentials | null>();
  }

  const teachers = await AppDataSource.getRepository(Teacher).findBy({
    id: In(teacherIds),
  });

  const map = new Map<number, CodeforcesCredentials | null>();

  for (const teacher of teachers) {
    if (hasPartialCodeforcesCredentials(teacher)) {
      console.warn(`[codeforces-topic-sync] teacher ${teacher.id} has partial Codeforces credentials; using public API fallback`);
    }

    map.set(
      teacher.id,
      resolveCodeforcesCredentials(teacher.codeforces_api_key, teacher.codeforces_api_secret),
    );
  }

  return map;
}

async function fetchCodeforcesGymMetadataSafely(
  gymId: string,
  codeforces: CodeforcesClient,
): Promise<{ gym_id: string; title: string } | null> {
  try {
    return await codeforces.fetchGymMetadata(gymId);
  } catch {
    return null;
  }
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

function shouldPullTopicStanding(topic: Topic, now: Date): boolean {
  if (topic.closed_at) {
    return false;
  }

  if (!topic.last_pulled_at) {
    return true;
  }

  return now.getTime() - topic.last_pulled_at.getTime() >= CODEFORCES_STANDING_SYNC_INTERVAL_MS;
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
      const student = row.handles.map((handle) => studentByHandle.get(handle)).find(Boolean);
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

export async function syncCodeforcesTopicsOnce(): Promise<void> {
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

  for (const topic of topics) {
    const gymId = topic.gym_id ?? extractGymIdFromLink(topic.gym_link);
    if (!gymId) {
      continue;
    }

    const credentials = credentialsByTeacherId.get(topic.teacher_id) ?? null;
    const codeforces = new CodeforcesClient(credentials);
    const synced = await fetchCodeforcesGymMetadataSafely(gymId, codeforces);
    if (!synced) {
      continue;
    }

    if (topic.gym_id === synced.gym_id && topic.title === synced.title) {
      if (shouldPullTopicStanding(topic, now) && await syncTopicStanding(topic, codeforces, now)) {
        standingSyncCount += 1;
      }
      continue;
    }

    topic.gym_id = synced.gym_id;
    topic.title = synced.title;
    dirty.push(topic);

    if (shouldPullTopicStanding(topic, now) && await syncTopicStanding(topic, codeforces, now)) {
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
}): IntervalJob {
  return {
    name: 'codeforces-topic-sync',
    enabled: options.enabled,
    intervalMs: Math.max(1, options.intervalSeconds) * 1000,
    run: syncCodeforcesTopicsOnce,
  };
}
