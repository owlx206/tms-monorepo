import { type EntityManager, type FindOptionsWhere, In, IsNull, Not } from 'typeorm';
import { type AttendanceListFilters, type AttendanceRecordSummary, type ClassDetails, type ClassDiscordGuildSummary, type ClassListFilters, type ClassScheduleSummary, type ClassStatus, type ClassSummary, type SessionAttendanceSummary, type SessionListFilters, SessionStatus, type SessionSummary } from '../../../contracts/types.js';
import { HttpError } from '../../../../../shared/errors/HttpError.js';
import { Attendance } from '../../../../../infrastructure/database/entities/attendance.entity.js';
import { Session } from '../../../../../infrastructure/database/entities/session.entity.js';
import { StudentStatus } from '../../../../student/contracts/types.js';
import { Enrollment } from '../../../../../infrastructure/database/entities/enrollment.entity.js';
import { Student } from '../../../../../infrastructure/database/entities/student.entity.js';
import { ClassDiscordBinding } from '../../../../../infrastructure/database/entities/discord/class-discord-binding.entity.js';
import { ClassSchedule } from '../../../../../infrastructure/database/entities/class-schedule.entity.js';
import { Class } from '../../../../../infrastructure/database/entities/class.entity.js';
import { Gym } from '../../../../../infrastructure/database/entities/gym/gym.entity.js';
import { GymProblem } from '../../../../../infrastructure/database/entities/gym/gym-problem.entity.js';
import { GymStanding } from '../../../../../infrastructure/database/entities/gym/gym-standing.entity.js';
import { StudentDiscordCredential } from '../../../../../infrastructure/database/entities/student-discord-credential.entity.js';
import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { DiscordGuildChannelCache } from '../../../../../infrastructure/external/discord/cache/entities/discord-guild-channel-cache.entity.js';
import { DiscordUserGuild } from '../../../../../infrastructure/external/discord/cache/entities/discord-user-guild.entity.js';
import { TypeOrmDiscordCacheStore } from '../../../../../infrastructure/external/discord/cache/discord-cache.store.js';
import { findTeacherDiscordUserId } from '../../../../identity/infrastructure/persistence/typeorm/Writer.js';

export type ClassDiscordBindingContext = {
  id: number;
  teacher_id: number;
  class_id: number;
  discord_guild_id: string;
  name: string | null;
  attendance_voice_channel_id: string | null;
  notification_channel_id: string | null;
};

export async function listClassDiscordBindingsByClassIds(
  teacherId: number,
  classIds: number[],
): Promise<ClassDiscordBindingContext[]> {
  const uniqueClassIds = Array.from(new Set(classIds.filter((classId) => Number.isInteger(classId) && classId > 0)));
  if (uniqueClassIds.length === 0) {
    return [];
  }

  const bindings = await AppDataSource.getRepository(ClassDiscordBinding).findBy({
    teacher_id: teacherId,
    class_id: In(uniqueClassIds),
  });

  return bindings.map((binding) => ({
    id: binding.id,
    teacher_id: binding.teacher_id,
    class_id: binding.class_id,
    discord_guild_id: binding.discord_guild_id,
    name: binding.name,
    attendance_voice_channel_id: binding.attendance_voice_channel_id,
    notification_channel_id: binding.notification_channel_id,
  }));
}

export async function listTeacherDiscordGuilds(teacherId: number): Promise<Array<{
  id: number;
  teacher_id: number;
  discord_guild_id: string;
  name: string | null;
  synced_at: Date | null;
  binding_guild_id: number | null;
  binding_role: 'unbound' | 'class';
  binding_class_id: number | null;
  binding_class_name: string | null;
  binding_notification_channel_id: string | null;
  binding_notification_channel_name: string | null;
  binding_notification_channel_cache_id: number | null;
  binding_attendance_voice_channel_id: string | null;
  binding_attendance_voice_channel_name: string | null;
  binding_attendance_voice_channel_cache_id: number | null;
}>> {
  const discordUserId = await findTeacherDiscordUserId(teacherId);
  if (!discordUserId) {
    return [];
  }

  return AppDataSource.getRepository(DiscordUserGuild)
    .createQueryBuilder('user_guild')
    .leftJoin(
      ClassDiscordBinding,
      'class_binding',
      'class_binding.teacher_id = :teacherId AND class_binding.discord_guild_id = user_guild.discord_guild_id',
    )
    .leftJoin(
      Class,
      'class',
      'class.id = class_binding.class_id AND class.teacher_id = class_binding.teacher_id',
    )
    .leftJoin(
      DiscordGuildChannelCache,
      'notification_channel',
      'notification_channel.discord_user_id = user_guild.discord_user_id AND notification_channel.discord_guild_id = class_binding.discord_guild_id AND notification_channel.discord_channel_id = class_binding.notification_channel_id',
    )
    .leftJoin(
      DiscordGuildChannelCache,
      'voice_channel',
      'voice_channel.discord_user_id = user_guild.discord_user_id AND voice_channel.discord_guild_id = class_binding.discord_guild_id AND voice_channel.discord_channel_id = class_binding.attendance_voice_channel_id',
    )
    .select('user_guild.id', 'id')
    .addSelect('user_guild.discord_guild_id', 'discord_guild_id')
    .addSelect('user_guild.name', 'name')
    .addSelect('user_guild.synced_at', 'synced_at')
    .addSelect(`
      CASE
        WHEN class_binding.id IS NOT NULL THEN 'class'
        ELSE 'unbound'
      END
    `, 'binding_role')
    .addSelect('class_binding.id', 'binding_guild_id')
    .addSelect('class_binding.class_id', 'binding_class_id')
    .addSelect('class.name', 'binding_class_name')
    .addSelect('class_binding.notification_channel_id', 'binding_notification_channel_id')
    .addSelect('notification_channel.name', 'binding_notification_channel_name')
    .addSelect('notification_channel.id', 'binding_notification_channel_id_ref')
    .addSelect('class_binding.attendance_voice_channel_id', 'binding_attendance_voice_channel_id')
    .addSelect('voice_channel.name', 'binding_attendance_voice_channel_name')
    .addSelect('voice_channel.id', 'binding_attendance_voice_channel_id_ref')
    .where('user_guild.discord_user_id = :discordUserId', { teacherId, discordUserId })
    .orderBy('COALESCE(user_guild.name, user_guild.discord_guild_id)', 'ASC')
    .getRawMany<{
      id: string;
      discord_guild_id: string;
      name: string | null;
      synced_at: string | Date | null;
      binding_guild_id: string | null;
      binding_role: 'unbound' | 'class';
      binding_class_id: string | null;
      binding_class_name: string | null;
      binding_notification_channel_id: string | null;
      binding_notification_channel_name: string | null;
      binding_notification_channel_id_ref: string | null;
      binding_attendance_voice_channel_id: string | null;
      binding_attendance_voice_channel_name: string | null;
      binding_attendance_voice_channel_id_ref: string | null;
    }>()
    .then((rows) => rows.map((row) => ({
      id: Number(row.id),
      teacher_id: teacherId,
      discord_guild_id: row.discord_guild_id,
      name: row.name,
      synced_at: row.synced_at ? new Date(row.synced_at) : null,
      binding_guild_id: row.binding_guild_id === null ? null : Number(row.binding_guild_id),
      binding_role: row.binding_role,
      binding_class_id: row.binding_class_id === null ? null : Number(row.binding_class_id),
      binding_class_name: row.binding_class_name,
      binding_notification_channel_id: row.binding_notification_channel_id,
      binding_notification_channel_name: row.binding_notification_channel_name,
      binding_notification_channel_cache_id: row.binding_notification_channel_id_ref === null ? null : Number(row.binding_notification_channel_id_ref),
      binding_attendance_voice_channel_id: row.binding_attendance_voice_channel_id,
      binding_attendance_voice_channel_name: row.binding_attendance_voice_channel_name,
      binding_attendance_voice_channel_cache_id: row.binding_attendance_voice_channel_id_ref === null ? null : Number(row.binding_attendance_voice_channel_id_ref),
    })));
}

export async function listTeacherDiscordChannelsForGuild(
  teacherId: number,
  discordGuildId: string,
): Promise<Array<{
  id: number;
  teacher_id: number;
  discord_guild_id: string;
  discord_channel_id: string;
  name: string;
  type: 'text' | 'voice';
  synced_at: Date;
}>> {
  const discordUserId = await findTeacherDiscordUserId(teacherId);
  if (!discordUserId) {
    return [];
  }

  const channels = await new TypeOrmDiscordCacheStore().listChannelsForOwnerAndGuild(
    discordUserId,
    discordGuildId,
  );

  return channels.map((channel) => ({
    ...channel,
    teacher_id: teacherId,
  }));
}

export type CodeforcesBoundGymSyncTarget = {
  id: number;
  teacher_id: number;
  class_id: number;
  title: string;
  gym_link: string;
  gym_id: string | null;
  pull_interval_minutes: number;
  last_pulled_at: Date | null;
  created_at: Date;
};

export class TypeOrmGymReader {
  constructor(private readonly manager: EntityManager) {}

  listGymsForTeacher(teacherId: number, filters: { class_id?: number | null }) {
    return this.manager.getRepository(Gym).find({
      where: {
        teacher_id: teacherId,
        ...(filters.class_id === null
          ? { class_id: IsNull() }
          : filters.class_id !== undefined
            ? { class_id: filters.class_id }
            : {}),
      },
      order: {
        created_at: 'DESC',
      },
    });
  }

  findOwnedGym(teacherId: number, gymId: number) {
    return this.manager.getRepository(Gym).findOneBy({
      id: gymId,
      teacher_id: teacherId,
    });
  }

  findOwnedClassGym(teacherId: number, classId: number, gymId: number) {
    return this.manager.getRepository(Gym).findOneBy({
      id: gymId,
      teacher_id: teacherId,
      class_id: classId,
    });
  }

  listGymProblems(teacherId: number, gymId: number) {
    return this.manager.getRepository(GymProblem).find({
      where: {
        teacher_id: teacherId,
        topic_id: gymId,
      },
      order: {
        problem_index: 'ASC',
      },
    });
  }

  listActiveEnrollmentsForClass(teacherId: number, classId: number) {
    return this.manager.getRepository(Enrollment).find({
      where: {
        teacher_id: teacherId,
        class_id: classId,
        unenrolled_at: IsNull(),
      },
    });
  }

  findStudentsByIds(teacherId: number, studentIds: number[]) {
    if (studentIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.manager.getRepository(Student).findBy({
      teacher_id: teacherId,
      id: In(studentIds),
    });
  }

  listGymStandings(teacherId: number, gymId: number) {
    return this.manager.getRepository(GymStanding).find({
      where: {
        teacher_id: teacherId,
        topic_id: gymId,
      },
    });
  }

  async listBoundCodeforcesGymsForTeacher(teacherId: number): Promise<CodeforcesBoundGymSyncTarget[]> {
    const gyms = await this.manager.getRepository(Gym).find({
      where: {
        teacher_id: teacherId,
        class_id: Not(IsNull()),
      },
    });

    return gyms
      .filter((gym): gym is Gym & { class_id: number } => gym.class_id !== null)
      .map((gym) => ({
        id: gym.id,
        teacher_id: gym.teacher_id,
        class_id: gym.class_id,
        title: gym.title,
        gym_link: gym.gym_link,
        gym_id: gym.gym_id,
        pull_interval_minutes: gym.pull_interval_minutes,
        last_pulled_at: gym.last_pulled_at,
        created_at: gym.created_at,
      }));
  }
}

// TypeOrmAttendanceReader.ts
type SessionAttendanceRow = SessionAttendanceSummary['attendance'][number];

export class TypeOrmAttendanceReader {
  constructor(private readonly manager: EntityManager) {}

  async getSessionAttendance(teacherId: number, sessionId: number): Promise<SessionAttendanceSummary> {
    const session = await this.manager.getRepository(Session).findOneBy({
      id: sessionId,
      teacher_id: teacherId,
    });

    if (!session) {
      throw new HttpError('session not found', 404);
    }

    const attendanceRecords = await this.manager.getRepository(Attendance).find({
      where: {
        teacher_id: teacherId,
        session_id: sessionId,
      },
    });

    const studentRows = await this.manager.query(
      `
        SELECT
          student.id AS student_id,
          student.full_name AS student_name,
          student.status AS student_status
        FROM students AS student
        INNER JOIN enrollments AS enrollment
          ON enrollment.teacher_id = student.teacher_id
          AND enrollment.student_id = student.id
          AND enrollment.class_id = $2
          AND enrollment.enrolled_at <= $3
          AND (enrollment.unenrolled_at IS NULL OR enrollment.unenrolled_at > $3)
        WHERE student.teacher_id = $1
        ORDER BY student.full_name ASC
      `,
      [teacherId, session.class_id, session.scheduled_at],
    ) as Array<{
      student_id: number | string;
      student_name: string;
      student_status: SessionAttendanceRow['student_status'];
    }>;

    const attendanceByStudentId = new Map<number, Attendance>();
    attendanceRecords.forEach((record) => {
      attendanceByStudentId.set(record.student_id, record);
    });

    return {
      session: {
        id: session.id,
        teacher_id: session.teacher_id,
        class_id: session.class_id,
        scheduled_at: session.scheduled_at,
        end_time: session.end_time,
        status: session.status as SessionStatus,
        is_manual: session.is_manual,
        created_at: session.created_at,
        cancelled_at: session.cancelled_at,
      },
      attendance: studentRows.map((student) => {
        const studentId = Number(student.student_id);
        const attendance = attendanceByStudentId.get(studentId);

        return {
          student_id: studentId,
          student_name: student.student_name,
          student_status: student.student_status,
          attendance_id: attendance?.id ?? null,
          attendance_status: attendance?.status ?? null,
          source: attendance?.source ?? null,
          notes: attendance?.notes ?? null,
          overridden_at: attendance?.overridden_at ?? null,
        };
      }),
    };
  }

  async listAttendanceRecords(
    teacherId: number,
    filters: AttendanceListFilters,
  ): Promise<AttendanceRecordSummary[]> {
    const records = await this.manager.getRepository(Attendance).find({
      where: {
        teacher_id: teacherId,
        ...(filters.session_id !== undefined ? { session_id: filters.session_id } : {}),
        ...(filters.student_id !== undefined ? { student_id: filters.student_id } : {}),
        ...(filters.status !== undefined ? { status: filters.status } : {}),
      },
      order: {
        id: 'DESC',
      },
    });

    return records.map((record) => ({
      id: record.id,
      teacher_id: record.teacher_id,
      session_id: record.session_id,
      student_id: record.student_id,
      status: record.status,
      source: record.source,
      overridden_at: record.overridden_at,
      notes: record.notes,
    }));
  }
}

// TypeOrmClassReader.ts
export class TypeOrmClassReader {
  constructor(private readonly manager: EntityManager) {}

  countOwnedClasses(teacherId: number, classIds: number[]): Promise<number> {
    if (classIds.length === 0) {
      return Promise.resolve(0);
    }

    return this.manager.getRepository(Class).countBy({
      id: In(classIds),
      teacher_id: teacherId,
    });
  }

  countOwnedSessions(teacherId: number, sessionIds: number[]): Promise<number> {
    if (sessionIds.length === 0) {
      return Promise.resolve(0);
    }

    return this.manager.getRepository(Session).countBy({
      id: In(sessionIds),
      teacher_id: teacherId,
    });
  }

  countOwnedGyms(teacherId: number, gymIds: number[]): Promise<number> {
    if (gymIds.length === 0) {
      return Promise.resolve(0);
    }

    return this.manager.getRepository(Gym).countBy({
      id: In(gymIds),
      teacher_id: teacherId,
    });
  }

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

    const [schedules, discordGuild, activeStudents, topics] = await Promise.all([
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
      this.manager.getRepository(ClassDiscordBinding).findOneBy({
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
        .leftJoin(StudentDiscordCredential, 'discord_credential', 'discord_credential.student_id = student.id')
        .where('student.teacher_id = :teacherId', { teacherId })
        .andWhere('student.status = :activeStatus', { activeStatus: StudentStatus.Active })
        .orderBy('student.full_name', 'ASC')
        .select([
          'student.id AS id',
          'student.teacher_id AS teacher_id',
          'student.full_name AS full_name',
          'student.codeforces_handle AS codeforces_handle',
          'discord_credential.discord_username AS discord_username',
          'discord_credential.discord_user_id AS discord_user_id',
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
      this.manager.getRepository(Gym).find({
        where: {
          teacher_id: teacherId,
          class_id: classId,
        },
        order: {
          created_at: 'DESC',
        },
      }),
    ]);

    const topicIds = topics.map((topic) => topic.id);
    const [topicProblems, topicStandings] = topicIds.length === 0
      ? [[], []] as [GymProblem[], GymStanding[]]
      : await Promise.all([
        this.manager.getRepository(GymProblem)
          .createQueryBuilder('problem')
          .where('problem.teacher_id = :teacherId', { teacherId })
          .andWhere('problem.topic_id IN (:...topicIds)', { topicIds })
          .orderBy('problem.topic_id', 'ASC')
          .addOrderBy('problem.problem_index', 'ASC')
          .getMany(),
        this.manager.getRepository(GymStanding)
          .createQueryBuilder('standing')
          .where('standing.teacher_id = :teacherId', { teacherId })
          .andWhere('standing.topic_id IN (:...topicIds)', { topicIds })
          .getMany(),
      ]);

    const activeStudentIds = new Set(activeStudents.map((student) => Number(student.id)));
    const problemsByTopicId = new Map<number, GymProblem[]>();
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
      discord_guild: discordGuild ? this.toDiscordGuildSummary(discordGuild) : null,
      active_students: activeStudents.map((student) => ({
        id: Number(student.id),
        teacher_id: Number(student.teacher_id),
        full_name: student.full_name,
        codeforces_handle: student.codeforces_handle,
        discord_username: student.discord_username,
        discord_user_id: student.discord_user_id,
        phone: student.phone,
        status: student.status as StudentStatus,
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
          class_id: classId,
          title: topic.title,
          gym_link: topic.gym_link,
          gym_id: topic.gym_id,
          closed_at: topic.closed_at,
          pull_interval_minutes: topic.pull_interval_minutes,
          last_pulled_at: topic.last_pulled_at,
          created_at: topic.created_at,
          status: 'active' as const,
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
      is_ready: schedules.length > 0 && discordGuild !== null,
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

  private toDiscordGuildSummary(binding: ClassDiscordBinding): ClassDiscordGuildSummary {
    return {
      id: binding.id,
      teacher_id: binding.teacher_id,
      class_id: binding.class_id,
      discord_guild_id: binding.discord_guild_id,
      name: binding.name,
      attendance_voice_channel_id: binding.attendance_voice_channel_id,
      notification_channel_id: binding.notification_channel_id,
    };
  }
}

// TypeOrmClassScheduleReader.ts
export class TypeOrmClassScheduleReader {
  constructor(private readonly manager: EntityManager) {}

  async listClassSchedules(teacherId: number, classId: number): Promise<ClassScheduleSummary[]> {
    const schedules = await this.manager.getRepository(ClassSchedule).find({
      where: {
        teacher_id: teacherId,
        class_id: classId,
      },
      order: {
        day_of_week: 'ASC',
        start_time: 'ASC',
        end_time: 'ASC',
      },
    });

    return schedules.map((schedule) => ({
      id: schedule.id,
      teacher_id: schedule.teacher_id,
      class_id: schedule.class_id,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
    }));
  }
}

// TypeOrmSessionReader.ts
export class TypeOrmSessionReader {
  constructor(private readonly manager: EntityManager) {}

  async listSessions(teacherId: number, filters: SessionListFilters): Promise<SessionSummary[]> {
    const queryBuilder = this.manager
      .getRepository(Session)
      .createQueryBuilder('session')
      .where('session.teacher_id = :teacherId', { teacherId });

    if (filters.class_id !== undefined) {
      queryBuilder.andWhere('session.class_id = :classId', { classId: filters.class_id });
    }

    if (filters.status !== undefined) {
      queryBuilder.andWhere('session.status = :status', { status: filters.status });
    }

    if (filters.from !== undefined) {
      queryBuilder.andWhere('session.scheduled_at >= :from', { from: filters.from });
    }

    if (filters.to !== undefined) {
      queryBuilder.andWhere('session.scheduled_at <= :to', { to: filters.to });
    }

    const sessions = await queryBuilder
      .orderBy('session.scheduled_at', 'ASC')
      .getMany();

    return sessions.map((session) => ({
      id: session.id,
      teacher_id: session.teacher_id,
      class_id: session.class_id,
      scheduled_at: session.scheduled_at,
      end_time: session.end_time,
      status: session.status,
      is_manual: session.is_manual,
      created_at: session.created_at,
      cancelled_at: session.cancelled_at,
    }));
  }
}
