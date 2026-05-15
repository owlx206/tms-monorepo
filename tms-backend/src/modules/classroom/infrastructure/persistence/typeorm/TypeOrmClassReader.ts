import type { EntityManager, FindOptionsWhere } from 'typeorm';

import { Enrollment, Student, StudentStatus } from '../../../../../entities/index.js';
import type { ClassStatus } from '../../../../../entities/enums.js';
import type {
  ClassDetails,
  ClassDiscordServerSummary,
  ClassListFilters,
  ClassScheduleSummary,
  ClassSummary,
} from '../../../application/dto/ClassDto.js';
import { DiscordServer } from '../../../../../entities/discord-server.entity.js';
import { ClassSchedule } from '../../../../../entities/class-schedule.entity.js';
import { Class } from '../../../../../entities/class.entity.js';
import { Topic } from '../../../../../entities/topic.entity.js';
import { TopicProblem } from '../../../../../entities/topic-problem.entity.js';
import { TopicStanding } from '../../../../../entities/topic-standing.entity.js';

export class TypeOrmClassReader {
  constructor(private readonly manager: EntityManager) {}

  async listClasses(teacherId: number, filters: ClassListFilters): Promise<ClassSummary[]> {
    if (filters.ready_only) {
      const classes = await this.manager.getRepository(Class)
        .createQueryBuilder('classEntity')
        .where('classEntity.teacher_id = :teacherId', { teacherId })
        .andWhere(filters.status ? 'classEntity.status = :status' : '1=1', { status: filters.status })
        .andWhere((qb) => {
          const scheduleSubquery = qb.subQuery()
            .select('1')
            .from(ClassSchedule, 'schedule')
            .where('schedule.teacher_id = classEntity.teacher_id')
            .andWhere('schedule.class_id = classEntity.id')
            .getQuery();
          return `EXISTS ${scheduleSubquery}`;
        })
        .orderBy('classEntity.created_at', 'DESC')
        .getMany();

      return classes.map((classEntity) => this.toSummary(classEntity));
    }

    const where: FindOptionsWhere<Class> = {
      teacher_id: teacherId,
      ...(filters.status ? { status: filters.status as ClassStatus } : {}),
    };

    const classes = await this.manager.getRepository(Class).find({
      where,
      order: {
        created_at: 'DESC',
      },
    });

    return classes.map((classEntity) => this.toSummary(classEntity));
  }

  async getClassById(teacherId: number, classId: number): Promise<ClassSummary | null> {
    const classEntity = await this.manager.getRepository(Class).findOneBy({
      id: classId,
      teacher_id: teacherId,
    });

    return classEntity ? this.toSummary(classEntity) : null;
  }

  async getClassDetails(teacherId: number, classId: number): Promise<ClassDetails | null> {
    const classEntity = await this.manager.getRepository(Class).findOneBy({
      id: classId,
      teacher_id: teacherId,
    });

    if (!classEntity) {
      return null;
    }

    const [schedules, discordServer, activeStudents, topics] = await Promise.all([
      this.manager.getRepository(ClassSchedule).find({
        where: {
          teacher_id: teacherId,
          class_id: classId,
        },
        order: {
          day_of_week: 'ASC',
          start_time: 'ASC',
        },
      }),
      this.manager.getRepository(DiscordServer).findOneBy({
        teacher_id: teacherId,
        class_id: classId,
      }),
      this.manager.getRepository(Student)
        .createQueryBuilder('student')
        .innerJoin(Enrollment, 'enrollment', [
          'enrollment.student_id = student.id',
          'enrollment.teacher_id = student.teacher_id',
          'enrollment.unenrolled_at IS NULL',
          'enrollment.class_id = :classId',
        ].join(' AND '), { classId })
        .where('student.teacher_id = :teacherId', { teacherId })
        .andWhere('student.status = :activeStatus', { activeStatus: StudentStatus.Active })
        .orderBy('student.full_name', 'ASC')
        .select([
          'student.id AS id',
          'student.teacher_id AS teacher_id',
          'student.full_name AS full_name',
          'student.codeforces_handle AS codeforces_handle',
          'student.discord_username AS discord_username',
          'student.discord_user_id AS discord_user_id',
          'student.phone AS phone',
          'student.status AS status',
          'enrollment.enrolled_at AS enrolled_at',
        ])
        .getRawMany<{
          id: number;
          teacher_id: number;
          full_name: string;
          codeforces_handle: string | null;
          discord_username: string | null;
          discord_user_id: string | null;
          phone: string | null;
          status: string;
          enrolled_at: Date;
        }>(),
      this.manager.getRepository(Topic).find({
        where: {
          teacher_id: teacherId,
          class_id: classId,
        },
        order: {
          closed_at: 'ASC',
          created_at: 'DESC',
        },
      }),
    ]);

    const topicIds = topics.map((topic) => topic.id);
    const [topicProblems, topicStandings] = topicIds.length === 0
      ? [[], []] as [TopicProblem[], TopicStanding[]]
      : await Promise.all([
        this.manager.getRepository(TopicProblem)
          .createQueryBuilder('problem')
          .where('problem.teacher_id = :teacherId', { teacherId })
          .andWhere('problem.topic_id IN (:...topicIds)', { topicIds })
          .orderBy('problem.topic_id', 'ASC')
          .addOrderBy('problem.problem_index', 'ASC')
          .getMany(),
        this.manager.getRepository(TopicStanding)
          .createQueryBuilder('standing')
          .where('standing.teacher_id = :teacherId', { teacherId })
          .andWhere('standing.topic_id IN (:...topicIds)', { topicIds })
          .getMany(),
      ]);

    const activeStudentIds = new Set(activeStudents.map((student) => Number(student.id)));
    const problemsByTopicId = new Map<number, TopicProblem[]>();
    topicProblems.forEach((problem) => {
      const problems = problemsByTopicId.get(problem.topic_id);
      if (problems) {
        problems.push(problem);
        return;
      }

      problemsByTopicId.set(problem.topic_id, [problem]);
    });

    const solvedProblemIdsByTopicStudent = new Map<string, Set<number>>();
    topicStandings.forEach((standing) => {
      if (!standing.solved || !activeStudentIds.has(standing.student_id)) {
        return;
      }

      const key = `${standing.topic_id}:${standing.student_id}`;
      const solvedProblemIds = solvedProblemIdsByTopicStudent.get(key);
      if (solvedProblemIds) {
        solvedProblemIds.add(standing.problem_id);
        return;
      }

      solvedProblemIdsByTopicStudent.set(key, new Set([standing.problem_id]));
    });

    return {
      class: this.toSummary(classEntity),
      schedules: schedules.map((schedule) => this.toScheduleSummary(schedule)),
      discord_server: discordServer ? this.toDiscordServerSummary(discordServer) : null,
      active_students: activeStudents.map((student) => ({
        id: Number(student.id),
        teacher_id: Number(student.teacher_id),
        full_name: student.full_name,
        codeforces_handle: student.codeforces_handle,
        discord_username: student.discord_username,
        discord_user_id: student.discord_user_id,
        phone: student.phone,
        status: student.status,
        enrolled_at: student.enrolled_at,
      })),
      topics: topics.map((topic) => {
        const problems = problemsByTopicId.get(topic.id) ?? [];
        let solvedCount = 0;
        let completedStudents = 0;

        activeStudentIds.forEach((studentId) => {
          const solvedProblemIds = solvedProblemIdsByTopicStudent.get(`${topic.id}:${studentId}`);
          const studentSolvedCount = solvedProblemIds?.size ?? 0;
          solvedCount += studentSolvedCount;

          if (problems.length > 0 && studentSolvedCount >= problems.length) {
            completedStudents += 1;
          }
        });

        return {
          id: topic.id,
          teacher_id: topic.teacher_id,
          class_id: topic.class_id,
          title: topic.title,
          gym_link: topic.gym_link,
          gym_id: topic.gym_id,
          closed_at: topic.closed_at,
          pull_interval_minutes: topic.pull_interval_minutes,
          last_pulled_at: topic.last_pulled_at,
          created_at: topic.created_at,
          status: topic.closed_at ? 'closed' as const : 'active' as const,
          problems: problems.map((problem) => ({
            id: problem.id,
            teacher_id: problem.teacher_id,
            topic_id: problem.topic_id,
            problem_index: problem.problem_index,
            problem_name: problem.problem_name,
          })),
          progress: {
            total_students: activeStudentIds.size,
            total_problems: problems.length,
            solved_count: solvedCount,
            completed_students: completedStudents,
            average_solved: activeStudentIds.size > 0 ? solvedCount / activeStudentIds.size : 0,
          },
        };
      }),
      is_ready: schedules.length > 0 && discordServer !== null,
    };
  }

  private toSummary(classEntity: Class): ClassSummary {
    return {
      id: classEntity.id,
      teacher_id: classEntity.teacher_id,
      name: classEntity.name,
      fee_per_session: classEntity.fee_per_session,
      status: classEntity.status,
      created_at: classEntity.created_at,
      archived_at: classEntity.archived_at,
    };
  }

  private toScheduleSummary(schedule: ClassSchedule): ClassScheduleSummary {
    return {
      id: schedule.id,
      teacher_id: schedule.teacher_id,
      class_id: schedule.class_id,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
    };
  }

  private toDiscordServerSummary(server: DiscordServer): ClassDiscordServerSummary {
    return {
      id: server.id,
      teacher_id: server.teacher_id,
      class_id: server.class_id,
      discord_server_id: server.discord_server_id,
      name: server.name,
      attendance_voice_channel_id: server.attendance_voice_channel_id,
      notification_channel_id: server.notification_channel_id,
    };
  }
}
