import { Between, type EntityManager, In, IsNull, MoreThanOrEqual } from 'typeorm';
import { type AttendanceRecordSummary, AttendanceSource, AttendanceStatus, type ClassScheduleInput, type ClassScheduleSummary, type ClassSummary, ClassStatus, type CreateClassInput, type CreateManualSessionInput, SessionStatus, type SessionSummary, type UpdateClassInput, type UpsertSessionAttendanceInput } from '../../../contracts/types.js';
import { HttpError } from '../../../../../shared/errors/HttpError.js';
import { Enrollment } from '../../../../../infrastructure/database/entities/enrollment.entity.js';
import { FeeRecord } from '../../../../../infrastructure/database/entities/fee-record.entity.js';
import { TypeOrmDiscordCacheStore } from '../../../../../infrastructure/external/discord/cache/discord-cache.store.js';
import { ClassDiscordBinding } from '../../../../../infrastructure/database/entities/discord/class-discord-binding.entity.js';
import { Gym } from '../../../../../infrastructure/database/entities/gym/gym.entity.js';
import { GymProblem } from '../../../../../infrastructure/database/entities/gym/gym-problem.entity.js';
import { GymStanding } from '../../../../../infrastructure/database/entities/gym/gym-standing.entity.js';
import { Attendance } from '../../../../../infrastructure/database/entities/attendance.entity.js';
import { Session } from '../../../../../infrastructure/database/entities/session.entity.js';
import { ClassSchedule } from '../../../../../infrastructure/database/entities/class-schedule.entity.js';
import { Class } from '../../../../../infrastructure/database/entities/class.entity.js';
import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { UpdateAttendance } from '../../../application/commands/UpdateAttendance.js';
import { syncVoiceAttendanceForSession } from '../../sync/discord-classroom-sync.worker.js';
import { Student } from '../../../../../infrastructure/database/entities/student.entity.js';
import { ArchiveClass } from '../../../application/commands/ArchiveClass.js';
import { CreateClass } from '../../../application/commands/CreateClass.js';
import { UpdateClass } from '../../../application/commands/UpdateClass.js';
import { CancelSession } from '../../../application/commands/CancelSession.js';
import { CreateSession } from '../../../application/commands/CreateSession.js';
import { TypeOrmFinanceFeeSync } from '../../../../finance/infrastructure/persistence/typeorm/Writer.js';
import { Teacher } from '../../../../../infrastructure/database/entities/teacher.entity.js';
import { TeacherCodeforcesCredential } from '../../../../../infrastructure/database/entities/teacher-codeforces-credential.entity.js';
import { findTeacherDiscordUserId } from '../../../../account/infrastructure/persistence/typeorm/Writer.js';
import {
  resolveCodeforcesCredentials,
  type CodeforcesContestListItem,
  type CodeforcesGymSnapshot,
} from '../../../../../infrastructure/external/codeforces/codeforces.js';
import { TypeOrmStudentReader } from '../../../../student/infrastructure/persistence/typeorm/Reader.js';

export class AttendanceMapper {
  static toSummary(attendance: Attendance): AttendanceRecordSummary {
    return {
      id: attendance.id,
      teacher_id: attendance.teacher_id,
      session_id: attendance.session_id,
      student_id: attendance.student_id,
      status: attendance.status,
      source: attendance.source,
      overridden_at: attendance.overridden_at,
      notes: attendance.notes,
    };
  }
}

export class ClassScheduleMapper {
  static toSummary(schedule: ClassSchedule): ClassScheduleSummary {
    return {
      id: schedule.id,
      teacher_id: schedule.teacher_id,
      class_id: schedule.class_id,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
    };
  }
}

export class SessionMapper {
  static toSummary(session: Session): SessionSummary {
    return {
      id: session.id,
      teacher_id: session.teacher_id,
      class_id: session.class_id,
      scheduled_at: session.scheduled_at,
      end_time: session.end_time,
      status: session.status,
      is_manual: session.is_manual,
      created_at: session.created_at,
      cancelled_at: session.cancelled_at,
    };
  }
}

export function dateOnlyToDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function combineDateAndTime(dateOnly: string, timeValue: string): Date {
  const date = dateOnlyToDate(dateOnly);
  const [hours, minutes, seconds] = timeValue.split(':').map(Number);

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    seconds,
    0,
  );
}

const TYPEORM_SAVE_BATCH_SIZE = 300;
const MSSQL_IN_CLAUSE_BATCH_SIZE = 1_000;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function buildCodeforcesGymLink(gymId: string): string {
  return `https://codeforces.com/gym/${gymId}`;
}

// ClassArchiveSupport.ts
function getSessionEndAt(session: Session): Date | null {
  if (!session.end_time) {
    return null;
  }

  const [hours = '0', minutes = '0', seconds = '0'] = session.end_time.split(':');
  const endAt = new Date(session.scheduled_at);
  endAt.setHours(Number(hours), Number(minutes), Number(seconds), 0);
  return endAt;
}

export async function assertClassArchivable(
  manager: EntityManager,
  teacherId: number,
  classId: number,
): Promise<void> {
  const enrollmentRepo = manager.getRepository(Enrollment);
  const gymRepo = manager.getRepository(Gym);
  const classDiscordBindingRepo = manager.getRepository(ClassDiscordBinding);
  const candidateSessions = await manager
    .getRepository(Session)
    .createQueryBuilder('session')
    .where('session.teacher_id = :teacherId', { teacherId })
    .andWhere('session.class_id = :classId', { classId })
    .andWhere('session.status IN (:...statuses)', {
      statuses: [SessionStatus.Scheduled, SessionStatus.InProgress],
    })
    .andWhere('session.end_time IS NOT NULL')
    .andWhere('CURRENT_TIMESTAMP >= session.scheduled_at')
    .getMany();
  const now = new Date();
  const ongoingSessionCount = candidateSessions.filter((session) => {
    const endAt = getSessionEndAt(session);
    return endAt !== null && now < endAt;
  }).length;

  if (ongoingSessionCount > 0) {
    throw new HttpError(
      'Không thể đóng lớp: lớp đang có buổi học diễn ra',
      409,
    );
  }

  const activeEnrollmentCount = await enrollmentRepo.count({
    where: {
      teacher_id: teacherId,
      class_id: classId,
      unenrolled_at: IsNull(),
    },
  });

  if (activeEnrollmentCount > 0) {
    throw new HttpError(
      `Không thể đóng lớp: còn ${activeEnrollmentCount} học sinh đang học trong lớp`,
      409,
    );
  }

  const activeTopicCount = await gymRepo.count({
    where: {
      teacher_id: teacherId,
      class_id: classId,
    },
  });

  if (activeTopicCount > 0) {
    throw new HttpError(
      `Không thể đóng lớp: còn ${activeTopicCount} GYM đang gắn với lớp`,
      409,
    );
  }

  const linkedDiscordGuildCount = await classDiscordBindingRepo.count({
    where: {
      teacher_id: teacherId,
      class_id: classId,
    },
  });

  if (linkedDiscordGuildCount > 0) {
    throw new HttpError(
      'Không thể đóng lớp: lớp vẫn đang liên kết với Discord guild',
      409,
    );
  }
}

export async function deleteAutoGeneratedSessionsForClass(
  manager: EntityManager,
  teacherId: number,
  classId: number,
): Promise<number> {
  const sessions = await manager.getRepository(Session).find({
    select: { id: true },
    where: {
      teacher_id: teacherId,
      class_id: classId,
      is_manual: false,
    },
  });

  if (sessions.length === 0) {
    return 0;
  }

  const sessionIds = sessions.map((session) => session.id);

  await manager.getRepository(FeeRecord).delete({
    teacher_id: teacherId,
    session_id: In(sessionIds),
  });

  await manager.getRepository(Attendance).delete({
    teacher_id: teacherId,
    session_id: In(sessionIds),
  });

  await manager.getRepository(Session).delete({
    teacher_id: teacherId,
    class_id: classId,
    is_manual: false,
  });

  return sessionIds.length;
}

// ClassScheduleSupport.ts
const SESSION_GENERATION_HORIZON_DAYS = 180;

function nowStartOfDay(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function dateOnlyString(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function combineDateWithEndTime(date: Date, endTime: string): Date {
  return combineDateAndTime(dateOnlyString(date), endTime);
}

function sessionOverlaps(
  sessionStart: Date,
  sessionEndTime: string,
  candidateStart: Date,
  candidateEndTime: string,
): boolean {
  const sessionEnd = combineDateWithEndTime(sessionStart, sessionEndTime);
  const candidateEnd = combineDateWithEndTime(candidateStart, candidateEndTime);

  return sessionStart < candidateEnd && candidateStart < sessionEnd;
}

function ensureScheduleTimeRange(schedule: ClassSchedule): void {
  if (schedule.end_time <= schedule.start_time) {
    throw new HttpError('end_time must be later than start_time', 400);
  }
}

function scheduleInputsOverlap(left: ClassScheduleInput, right: ClassScheduleInput): boolean {
  return left.day_of_week === right.day_of_week
    && left.start_time < right.end_time
    && right.start_time < left.end_time;
}

function assertNoOverlappingScheduleInputs(schedules: ClassScheduleInput[]): void {
  for (let leftIndex = 0; leftIndex < schedules.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < schedules.length; rightIndex += 1) {
      if (scheduleInputsOverlap(schedules[leftIndex], schedules[rightIndex])) {
        throw new HttpError('Lịch học không được giao nhau', 409);
      }
    }
  }
}

async function assertNoPersistedScheduleOverlap(
  manager: EntityManager,
  teacherId: number,
  schedules: ClassScheduleInput[],
  options?: {
    excludeClassId?: number;
    excludeScheduleId?: number;
  },
): Promise<void> {
  const scheduleRepo = manager.getRepository(ClassSchedule);

  for (const schedule of schedules) {
    const query = scheduleRepo
      .createQueryBuilder('schedule')
      .innerJoin(Class, 'class', 'class.id = schedule.class_id')
      .where('schedule.teacher_id = :teacherId', { teacherId })
      .andWhere('schedule.day_of_week = :dayOfWeek', { dayOfWeek: schedule.day_of_week })
      .andWhere('class.status = :activeStatus', { activeStatus: ClassStatus.Active })
      .andWhere('schedule.start_time < :endTime', { endTime: schedule.end_time })
      .andWhere(':startTime < schedule.end_time', { startTime: schedule.start_time });

    if (options?.excludeClassId !== undefined) {
      query.andWhere('schedule.class_id <> :excludeClassId', { excludeClassId: options.excludeClassId });
    }

    if (options?.excludeScheduleId !== undefined) {
      query.andWhere('schedule.id <> :excludeScheduleId', { excludeScheduleId: options.excludeScheduleId });
    }

    const overlappingSchedule = await query.getOne();

    if (overlappingSchedule) {
      throw new HttpError('Lịch học không được giao nhau', 409);
    }
  }
}

async function assertNoUpcomingSessionOverlapForSchedules(
  manager: EntityManager,
  teacherId: number,
  classId: number,
  schedules: ClassScheduleInput[],
): Promise<void> {
  if (schedules.length === 0) {
    return;
  }

  const now = new Date();
  const startDate = nowStartOfDay();
  const endDate = addDays(startDate, SESSION_GENERATION_HORIZON_DAYS);
  const sessionRepo = manager.getRepository(Session);
  const sessions = await sessionRepo.find({
    where: {
      teacher_id: teacherId,
      scheduled_at: Between(now, endOfDay(endDate)),
    },
  });

  const sessionsToCompare = sessions.filter((session) => (
    !session.isCancelled()
    && session.end_time !== null
    && (session.class_id !== classId || session.is_manual)
  ));

  for (const schedule of schedules) {
    for (let cursor = new Date(startDate); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
      if (cursor.getDay() !== schedule.day_of_week) {
        continue;
      }

      const scheduledAt = combineDateAndTime(dateOnlyString(cursor), schedule.start_time);

      if (scheduledAt < now) {
        continue;
      }

      const overlappingSession = sessionsToCompare.find((session) => (
        session.end_time !== null
        && sessionOverlaps(session.scheduled_at, session.end_time, scheduledAt, schedule.end_time)
      ));

      if (overlappingSession) {
        throw new HttpError('Lịch học bị trùng với buổi học đã có', 409);
      }
    }
  }
}

async function generateSessionsForSchedule(
  manager: EntityManager,
  teacherId: number,
  schedule: ClassSchedule,
): Promise<number> {
  const now = new Date();
  const startDate = nowStartOfDay();
  const endDate = addDays(startDate, SESSION_GENERATION_HORIZON_DAYS);

  if (endDate < startDate) {
    return 0;
  }

  const rangeStart = startDate;
  const rangeEnd = endOfDay(endDate);

  const sessionRepo = manager.getRepository(Session);
  const existingSessions = await sessionRepo.find({
    where: {
      teacher_id: teacherId,
      class_id: schedule.class_id,
      scheduled_at: Between(rangeStart, rangeEnd),
    },
  });

  const existingTimestamps = new Set(existingSessions.map((item) => item.scheduled_at.getTime()));
  const sessionsToCreate: Session[] = [];

  for (let cursor = new Date(startDate); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor.getDay() !== schedule.day_of_week) {
      continue;
    }

    const dateOnly = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    const scheduledAt = combineDateAndTime(dateOnly, schedule.start_time);
    const scheduledAtTimestamp = scheduledAt.getTime();

    if (scheduledAt < now) {
      continue;
    }

    if (existingTimestamps.has(scheduledAtTimestamp)) {
      continue;
    }

    sessionsToCreate.push(
      sessionRepo.create({
        teacher_id: teacherId,
        class_id: schedule.class_id,
        scheduled_at: scheduledAt,
        end_time: schedule.end_time,
        status: SessionStatus.Scheduled,
        is_manual: false,
      }),
    );

    existingTimestamps.add(scheduledAtTimestamp);
  }

  if (sessionsToCreate.length > 0) {
    await sessionRepo.save(sessionsToCreate);
  }

  return sessionsToCreate.length;
}

function sessionMatchesSchedule(session: Session, schedule: ClassSchedule): boolean {
  const scheduledTime = [
    String(session.scheduled_at.getHours()).padStart(2, '0'),
    String(session.scheduled_at.getMinutes()).padStart(2, '0'),
    String(session.scheduled_at.getSeconds()).padStart(2, '0'),
  ].join(':');

  return session.scheduled_at.getDay() === schedule.day_of_week
    && scheduledTime === schedule.start_time;
}

export async function reconcileGeneratedSessionsForClass(
  manager: EntityManager,
  teacherId: number,
  classId: number,
): Promise<{ sessions_created: number; sessions_removed: number }> {
  const scheduleRepo = manager.getRepository(ClassSchedule);
  const sessionRepo = manager.getRepository(Session);
  const schedules = await scheduleRepo.find({
    where: {
      teacher_id: teacherId,
      class_id: classId,
    },
  });

  const now = new Date();
  const upcomingGeneratedSessions = await sessionRepo.find({
    where: {
      teacher_id: teacherId,
      class_id: classId,
      status: SessionStatus.Scheduled,
      is_manual: false,
      scheduled_at: MoreThanOrEqual(now),
    },
  });

  const obsoleteSessions = upcomingGeneratedSessions.filter((session) => (
    !schedules.some((schedule) => sessionMatchesSchedule(session, schedule))
  ));
  const scheduleBySessionId = new Map<number, ClassSchedule>();
  upcomingGeneratedSessions.forEach((session) => {
    const schedule = schedules.find((item) => sessionMatchesSchedule(session, item));
    if (schedule) {
      scheduleBySessionId.set(session.id, schedule);
    }
  });
  const sessionsNeedingEndTimeUpdate = upcomingGeneratedSessions.filter((session) => {
    const schedule = scheduleBySessionId.get(session.id);
    return schedule && session.end_time !== schedule.end_time;
  });

  if (obsoleteSessions.length > 0) {
    await sessionRepo.remove(obsoleteSessions);
  }

  if (sessionsNeedingEndTimeUpdate.length > 0) {
    sessionsNeedingEndTimeUpdate.forEach((session) => {
      const schedule = scheduleBySessionId.get(session.id);
      session.end_time = schedule?.end_time ?? session.end_time;
    });
    await sessionRepo.save(sessionsNeedingEndTimeUpdate);
  }

  let sessionsCreated = 0;
  for (const schedule of schedules) {
    sessionsCreated += await generateSessionsForSchedule(manager, teacherId, schedule);
  }

  return {
    sessions_created: sessionsCreated,
    sessions_removed: obsoleteSessions.length,
  };
}

export async function replaceClassSchedules(
  manager: EntityManager,
  teacherId: number,
  classId: number,
  schedules: ClassScheduleInput[],
): Promise<void> {
  assertNoOverlappingScheduleInputs(schedules);
  await assertNoPersistedScheduleOverlap(manager, teacherId, schedules, { excludeClassId: classId });
  await assertNoUpcomingSessionOverlapForSchedules(manager, teacherId, classId, schedules);

  const scheduleRepo = manager.getRepository(ClassSchedule);
  const existingSchedules = await scheduleRepo.find({
    where: {
      teacher_id: teacherId,
      class_id: classId,
    },
  });

  if (existingSchedules.length > 0) {
    await scheduleRepo.remove(existingSchedules);
  }

  if (schedules.length > 0) {
    const schedulesToSave = schedules.map((input) => {
      const schedule = scheduleRepo.create({
        teacher_id: teacherId,
        class_id: classId,
        day_of_week: input.day_of_week,
        start_time: input.start_time,
        end_time: input.end_time,
      });

      ensureScheduleTimeRange(schedule);
      return schedule;
    });

    await scheduleRepo.save(schedulesToSave);
  }

  await reconcileGeneratedSessionsForClass(manager, teacherId, classId);
}

// TypeOrmAttendanceCommandHandlers.ts
export class TypeOrmAttendanceCommandHandlers {
  async upsertSessionAttendance(input: {
    teacherId: number;
    sessionId: number;
    studentId: number;
    attendance: UpsertSessionAttendanceInput;
  }): Promise<AttendanceRecordSummary | null> {
    return AppDataSource.transaction(async (manager) => {
      const attendanceWriter = new TypeOrmAttendanceWriter(manager);
      const finance = new TypeOrmSessionFinanceService(manager);
      const useCase = new UpdateAttendance(attendanceWriter, finance);
      return useCase.execute(input);
    });
  }

  syncSessionAttendance(input: {
    teacherId: number;
    sessionId: number;
  }) {
    return syncVoiceAttendanceForSession(input.teacherId, input.sessionId);
  }
}

// TypeOrmAttendanceWriter.ts
export class TypeOrmAttendanceWriter {
  constructor(private readonly manager: EntityManager) {}

  findSessionById(teacherId: number, sessionId: number): Promise<Session | null> {
    return this.manager.getRepository(Session).findOneBy({
      id: sessionId,
      teacher_id: teacherId,
    });
  }

  findClassById(teacherId: number, classId: number): Promise<Class | null> {
    return this.manager.getRepository(Class).findOneBy({
      id: classId,
      teacher_id: teacherId,
    });
  }

  findStudentById(teacherId: number, studentId: number): Promise<Student | null> {
    return this.manager.getRepository(Student).findOneBy({
      id: studentId,
      teacher_id: teacherId,
    });
  }

  findEnrollmentAtSessionTime(
    teacherId: number,
    studentId: number,
    classId: number,
    scheduledAt: Date,
  ): Promise<Enrollment | null> {
    return this.manager
      .getRepository(Enrollment)
      .createQueryBuilder('enrollment')
      .where('enrollment.teacher_id = :teacherId', { teacherId })
      .andWhere('enrollment.student_id = :studentId', { studentId })
      .andWhere('enrollment.class_id = :classId', { classId })
      .andWhere('enrollment.enrolled_at <= :scheduledAt', { scheduledAt })
      .andWhere('(enrollment.unenrolled_at IS NULL OR enrollment.unenrolled_at > :scheduledAt)', { scheduledAt })
      .orderBy('enrollment.enrolled_at', 'DESC')
      .getOne();
  }

  findEnrollmentsAtSessionTime(
    teacherId: number,
    classId: number,
    scheduledAt: Date,
  ): Promise<Enrollment[]> {
    return this.manager
      .getRepository(Enrollment)
      .createQueryBuilder('enrollment')
      .where('enrollment.teacher_id = :teacherId', { teacherId })
      .andWhere('enrollment.class_id = :classId', { classId })
      .andWhere('enrollment.enrolled_at <= :scheduledAt', { scheduledAt })
      .andWhere('(enrollment.unenrolled_at IS NULL OR enrollment.unenrolled_at > :scheduledAt)', { scheduledAt })
      .orderBy('enrollment.enrolled_at', 'DESC')
      .getMany();
  }

  findAttendanceForStudent(
    teacherId: number,
    sessionId: number,
    studentId: number,
  ): Promise<Attendance | null> {
    return this.manager.getRepository(Attendance).findOneBy({
      teacher_id: teacherId,
      session_id: sessionId,
      student_id: studentId,
    });
  }

  findAttendanceBySession(teacherId: number, sessionId: number): Promise<Attendance[]> {
    return this.manager.getRepository(Attendance).find({
      where: {
        teacher_id: teacherId,
        session_id: sessionId,
      },
    });
  }

  create(input: {
    teacher_id: number;
    session_id: number;
    student_id: number;
    status: Attendance['status'];
    source: Attendance['source'];
    overridden_at: Date | null;
    notes: string | null;
  }): Attendance {
    return this.manager.getRepository(Attendance).create(input);
  }

  save(attendance: Attendance): Promise<Attendance> {
    return this.manager.getRepository(Attendance).save(attendance);
  }

  async markBotPresentIfNotManual(input: {
    teacherId: number;
    sessionId: number;
    studentId: number;
  }): Promise<boolean> {
    const repo = this.manager.getRepository(Attendance);
    const existing = await repo.findOneBy({
      teacher_id: input.teacherId,
      session_id: input.sessionId,
      student_id: input.studentId,
    });

    if (!existing) {
      await repo.save(repo.create({
        teacher_id: input.teacherId,
        session_id: input.sessionId,
        student_id: input.studentId,
        status: AttendanceStatus.Present,
        source: AttendanceSource.Bot,
        overridden_at: null,
        notes: null,
      }));
      return true;
    }

    if (
      existing.source === AttendanceSource.Manual
      || existing.status === AttendanceStatus.AbsentExcused
    ) {
      return false;
    }

    existing.status = AttendanceStatus.Present;
    existing.source = AttendanceSource.Bot;
    existing.overridden_at = null;
    await repo.save(existing);
    return true;
  }

  remove(records: Attendance[]): Promise<Attendance[]> {
    return this.manager.getRepository(Attendance).remove(records);
  }
}

// TypeOrmClassArchiveGuard.ts
export class TypeOrmClassArchiveGuard {
  constructor(private readonly manager: EntityManager) {}

  assertArchivable(teacherId: number, classId: number): Promise<void> {
    return assertClassArchivable(this.manager, teacherId, classId);
  }
}

export class TypeOrmClassWriter {
  constructor(private readonly manager: EntityManager) {}

  async createClass(input: {
    teacherId: number;
    name: string;
    feePerSession: string;
  }): Promise<ClassSummary> {
    const classRepository = this.manager.getRepository(Class);
    const classEntity = classRepository.create({
      teacher_id: input.teacherId,
      name: input.name,
      fee_per_session: input.feePerSession,
    });

    return this.toSummary(await classRepository.save(classEntity));
  }

  async updateClass(input: {
    teacherId: number;
    classId: number;
    name?: string;
    feePerSession?: string;
  }): Promise<ClassSummary> {
    const classRepository = this.manager.getRepository(Class);
    const classEntity = await classRepository.findOneBy({
      id: input.classId,
      teacher_id: input.teacherId,
    });

    if (!classEntity) {
      throw new HttpError('class not found', 404);
    }

    if (classEntity.status !== ClassStatus.Active) {
      throw new HttpError('class is archived', 409);
    }

    if (input.name !== undefined) {
      classEntity.name = input.name;
    }

    if (input.feePerSession !== undefined) {
      classEntity.fee_per_session = input.feePerSession;
    }

    return this.toSummary(await classRepository.save(classEntity));
  }

  async archiveClass(input: {
    teacherId: number;
    classId: number;
    archivedAt: Date;
  }): Promise<ClassSummary> {
    const classRepository = this.manager.getRepository(Class);
    const classEntity = await classRepository.findOneBy({
      id: input.classId,
      teacher_id: input.teacherId,
    });

    if (!classEntity) {
      throw new HttpError('class not found', 404);
    }

    if (classEntity.status === ClassStatus.Archived) {
      return this.toSummary(classEntity);
    }

    classEntity.status = ClassStatus.Archived;
    classEntity.archived_at = input.archivedAt;

    return this.toSummary(await classRepository.save(classEntity));
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
}

export class TypeOrmClassroomDiscordWriter {
  constructor(private readonly manager: EntityManager = AppDataSource.manager) {}

  async findDiscordUserGuildById(teacherId: number, userGuildId: number) {
    const discordUserId = await findTeacherDiscordUserId(teacherId);
    if (!discordUserId) {
      return null;
    }

    return new TypeOrmDiscordCacheStore(this.manager).findGuildByOwnerAndId(discordUserId, userGuildId);
  }

  async findDiscordGuildChannelCacheById(teacherId: number, channelId: number) {
    const discordUserId = await findTeacherDiscordUserId(teacherId);
    if (!discordUserId) {
      return null;
    }

    return new TypeOrmDiscordCacheStore(this.manager).findChannelByOwnerAndId(discordUserId, channelId);
  }

  async findDiscordGuildChannelCacheByDiscordChannelId(teacherId: number, discordChannelId: string) {
    const discordUserId = await findTeacherDiscordUserId(teacherId);
    if (!discordUserId) {
      return null;
    }

    return new TypeOrmDiscordCacheStore(this.manager).findChannelByOwnerAndDiscordChannelId(
      discordUserId,
      discordChannelId,
    );
  }

  findDiscordGuildByClass(teacherId: number, classId: number) {
    return this.manager.getRepository(ClassDiscordBinding).findOneBy({
      teacher_id: teacherId,
      class_id: classId,
    });
  }

  findDiscordGuildByDiscordGuildId(teacherId: number, discordGuildId: string) {
    return this.manager.getRepository(ClassDiscordBinding).findOneBy({
      teacher_id: teacherId,
      discord_guild_id: discordGuildId,
    });
  }

  findDiscordGuildsByIds(teacherId: number, guildIds: number[]) {
    if (guildIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.manager.getRepository(ClassDiscordBinding).findBy({
      teacher_id: teacherId,
      id: In(guildIds),
    });
  }

  createClassDiscordBinding(values: Partial<ClassDiscordBinding>) {
    return this.manager.getRepository(ClassDiscordBinding).create(values);
  }

  saveClassDiscordBinding(binding: ClassDiscordBinding) {
    return this.manager.getRepository(ClassDiscordBinding).save(binding);
  }

  removeClassDiscordBinding(binding: ClassDiscordBinding) {
    return this.manager.getRepository(ClassDiscordBinding).remove(binding);
  }
}

export class TypeOrmGymWriter {
  constructor(private readonly manager: EntityManager = AppDataSource.manager) {}

  findClassById(classId: number) {
    return this.manager.getRepository(Class).findOneBy({ id: classId });
  }

  findTeacherById(teacherId: number) {
    return this.manager.getRepository(Teacher).findOneBy({ id: teacherId });
  }

  async resolveGymCodeforcesCredentials(teacherId: number) {
    const config = await this.manager.getRepository(TeacherCodeforcesCredential).findOneBy({
      teacher_id: teacherId,
    });
    const resolved = resolveCodeforcesCredentials(
      config?.codeforces_api_key,
      config?.codeforces_api_secret,
    );

    return resolved
      ? {
        apiKey: resolved.apiKey,
        apiSecret: resolved.apiSecret,
      }
      : null;
  }

  findOwnedGym(teacherId: number, gymId: number) {
    return this.manager.getRepository(Gym).findOneBy({
      id: gymId,
      teacher_id: teacherId,
    });
  }

  findClassGymByCodeforcesGymId(teacherId: number, classId: number, codeforcesGymId: string) {
    return this.manager.getRepository(Gym).findOneBy({
      teacher_id: teacherId,
      class_id: classId,
      gym_id: codeforcesGymId,
    });
  }

  findCatalogGym(teacherId: number, codeforcesGymId: string) {
    return this.manager.getRepository(Gym).findOneBy({
      teacher_id: teacherId,
      gym_id: codeforcesGymId,
      class_id: IsNull(),
    });
  }

  findOwnedClassGym(teacherId: number, classId: number, gymId: number) {
    return this.manager.getRepository(Gym).findOneBy({
      id: gymId,
      teacher_id: teacherId,
      class_id: classId,
    });
  }

  createGym(values: Partial<Gym>) {
    return this.manager.getRepository(Gym).create(values);
  }

  saveGym(gym: Gym) {
    return this.manager.getRepository(Gym).save(gym);
  }

  async syncCodeforcesGymCatalog(
    teacherId: number,
    ownedGyms: CodeforcesContestListItem[],
    pulledAt: Date,
  ): Promise<number> {
    const gymRepo = this.manager.getRepository(Gym);
    const ownedGymIdSet = new Set(ownedGyms.map((gym) => String(gym.id)));

    for (const gym of ownedGyms) {
      const gymId = String(gym.id);
      const existing = await gymRepo.findOneBy({
        teacher_id: teacherId,
        gym_id: gymId,
        class_id: IsNull(),
      });

      if (existing) {
        existing.title = gym.name.trim();
        existing.gym_link = buildCodeforcesGymLink(gymId);
        existing.last_pulled_at = pulledAt;
        await gymRepo.save(existing);
        continue;
      }

      await gymRepo.save(gymRepo.create({
        teacher_id: teacherId,
        class_id: null,
        gym_id: gymId,
        title: gym.name.trim(),
        gym_link: buildCodeforcesGymLink(gymId),
        pull_interval_minutes: 60,
        last_pulled_at: pulledAt,
      }));
    }

    const catalogGyms = await gymRepo.find({
      where: { teacher_id: teacherId, class_id: IsNull() },
      select: { id: true, gym_id: true },
    });
    const staleIds = catalogGyms
      .filter((gym) => gym.gym_id && !ownedGymIdSet.has(gym.gym_id))
      .map((gym) => gym.id);

    for (const batch of chunkArray(staleIds, MSSQL_IN_CLAUSE_BATCH_SIZE)) {
      await gymRepo.delete({ id: In(batch) });
    }

    return ownedGyms.length;
  }

  async syncCodeforcesGymStandingProjection(input: {
    teacherId: number;
    gymId: number;
    classId: number;
    standings: CodeforcesGymSnapshot;
    pulledAt: Date;
  }): Promise<boolean> {
    await AppDataSource.transaction(async (manager) => {
      const gymRepo = manager.getRepository(Gym);
      const gymProblemRepo = manager.getRepository(GymProblem);
      const gymStandingRepo = manager.getRepository(GymStanding);

      const gym = await gymRepo.findOneBy({
        id: input.gymId,
        teacher_id: input.teacherId,
        class_id: input.classId,
      });
      if (!gym) {
        return;
      }

      gym.gym_id = input.standings.gym_id;
      gym.title = input.standings.title;
      gym.last_pulled_at = input.pulledAt;
      await gymRepo.save(gym);

      const existingProblems = await gymProblemRepo.findBy({
        teacher_id: input.teacherId,
        topic_id: input.gymId,
      });
      const problemByIndex = new Map(existingProblems.map((problem) => [problem.problem_index, problem]));
      const syncedProblemIndexes = new Set(input.standings.problems.map((problem) => problem.index));
      const staleProblemIds = existingProblems
        .filter((problem) => !syncedProblemIndexes.has(problem.problem_index))
        .map((problem) => problem.id);

      for (const batch of chunkArray(staleProblemIds, MSSQL_IN_CLAUSE_BATCH_SIZE)) {
        await gymStandingRepo.delete({
          teacher_id: input.teacherId,
          topic_id: input.gymId,
          problem_id: In(batch),
        });
        await gymProblemRepo.delete({
          teacher_id: input.teacherId,
          topic_id: input.gymId,
          id: In(batch),
        });
      }

      const syncedProblems: GymProblem[] = [];
      for (const problemInput of input.standings.problems) {
        const existing = problemByIndex.get(problemInput.index);
        if (existing) {
          existing.problem_name = problemInput.name;
          syncedProblems.push(existing);
          continue;
        }

        syncedProblems.push(gymProblemRepo.create({
          teacher_id: input.teacherId,
          topic_id: input.gymId,
          problem_index: problemInput.index,
          problem_name: problemInput.name,
        }));
      }

      const savedProblems = syncedProblems.length > 0
        ? await gymProblemRepo.save(syncedProblems, { chunk: TYPEORM_SAVE_BATCH_SIZE })
        : [];
      const savedProblemByIndex = new Map(savedProblems.map((problem) => [problem.problem_index, problem]));

      const students = await new TypeOrmStudentReader(manager).listActiveCodeforcesStudentsForClass(
        input.teacherId,
        input.classId,
      );
      const activeStudentIdSet = new Set(students.map((student) => student.id));
      const studentByHandle = new Map<string, { id: number; codeforces_handle: string | null }>();
      students.forEach((student) => {
        const handle = student.codeforces_handle?.trim().toLowerCase();
        if (handle) {
          studentByHandle.set(handle, student);
        }
      });

      const resultByStudentProblem = new Map<string, { solved: boolean; penalty_minutes: number | null }>();
      input.standings.rows.forEach((row) => {
        const student = row.handles
          .map((handle) => studentByHandle.get(handle.trim().toLowerCase()))
          .find(Boolean);
        if (!student) {
          return;
        }

        input.standings.problems.forEach((problemInput, index) => {
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

      const existingStandings = await gymStandingRepo.findBy({
        teacher_id: input.teacherId,
        topic_id: input.gymId,
      });
      const staleStandingIds = existingStandings
        .filter((standing) => !activeStudentIdSet.has(standing.student_id))
        .map((standing) => standing.id);

      for (const batch of chunkArray(staleStandingIds, MSSQL_IN_CLAUSE_BATCH_SIZE)) {
        await gymStandingRepo.delete({
          teacher_id: input.teacherId,
          topic_id: input.gymId,
          id: In(batch),
        });
      }

      const standingByStudentProblem = new Map(
        existingStandings
          .filter((standing) => activeStudentIdSet.has(standing.student_id))
          .map((standing) => [`${standing.student_id}:${standing.problem_id}`, standing]),
      );

      const nextStandings: GymStanding[] = [];
      for (const student of students) {
        for (const problem of savedProblems) {
          const key = `${student.id}:${problem.id}`;
          const result = resultByStudentProblem.get(key) ?? { solved: false, penalty_minutes: null };
          const existing = standingByStudentProblem.get(key);

          if (existing) {
            existing.solved = result.solved;
            existing.penalty_minutes = result.penalty_minutes;
            existing.pulled_at = input.pulledAt;
            nextStandings.push(existing);
            continue;
          }

          nextStandings.push(gymStandingRepo.create({
            teacher_id: input.teacherId,
            topic_id: input.gymId,
            student_id: student.id,
            problem_id: problem.id,
            solved: result.solved,
            penalty_minutes: result.penalty_minutes,
            pulled_at: input.pulledAt,
          }));
        }
      }

      if (nextStandings.length > 0) {
        await gymStandingRepo.save(nextStandings, { chunk: TYPEORM_SAVE_BATCH_SIZE });
      }
    });

    return true;
  }

  async deleteGym(gym: Gym): Promise<Gym> {
    await this.manager.getRepository(GymStanding).delete({
      teacher_id: gym.teacher_id,
      topic_id: gym.id,
    });
    await this.manager.getRepository(GymProblem).delete({
      teacher_id: gym.teacher_id,
      topic_id: gym.id,
    });
    await this.manager.getRepository(Gym).delete({
      teacher_id: gym.teacher_id,
      id: gym.id,
    });

    return gym;
  }

}

// TypeOrmClassCommandHandlers.ts
export class TypeOrmClassCommandHandlers {
  async createClass(input: {
    teacherId: number;
    name: string;
    feePerSession: string;
    schedules: CreateClassInput['schedules'];
  }) {
    return AppDataSource.transaction(async (manager) => {
      const classes = new TypeOrmClassWriter(manager);
      const classSchedules = new TypeOrmClassScheduleService(manager);
      const useCase = new CreateClass(classes, classSchedules);

      return useCase.execute(input);
    });
  }

  async updateClass(input: {
    teacherId: number;
    classId: number;
    name?: string;
    feePerSession?: string;
    schedules?: UpdateClassInput['schedules'];
  }) {
    return AppDataSource.transaction(async (manager) => {
      const classes = new TypeOrmClassWriter(manager);
      const classSchedules = new TypeOrmClassScheduleService(manager);
      const useCase = new UpdateClass(classes, classSchedules);

      return useCase.execute(input);
    });
  }

  async archiveClass(input: {
    teacherId: number;
    classId: number;
    archivedAt: Date;
  }) {
    return AppDataSource.transaction(async (manager) => {
      const archiveGuard = new TypeOrmClassArchiveGuard(manager);
      const classes = new TypeOrmClassWriter(manager);
      const sessionLifecycle = new TypeOrmClassSessionLifecycle(manager);
      const useCase = new ArchiveClass(classes, archiveGuard, sessionLifecycle);

      return useCase.execute(input);
    });
  }
}

// TypeOrmClassScheduleService.ts
export class TypeOrmClassScheduleService {
  constructor(private readonly manager: EntityManager) {}

  replaceSchedules(teacherId: number, classId: number, schedules: ClassScheduleInput[]): Promise<void> {
    return replaceClassSchedules(this.manager, teacherId, classId, schedules);
  }

  async listSchedules(teacherId: number, classId: number): Promise<ClassScheduleSummary[]> {
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

    return schedules.map((schedule) => ClassScheduleMapper.toSummary(schedule));
  }
}

// TypeOrmClassSessionLifecycle.ts
export class TypeOrmClassSessionLifecycle {
  constructor(private readonly manager: EntityManager) {}

  deleteAutoGeneratedSessions(teacherId: number, classId: number): Promise<number> {
    return deleteAutoGeneratedSessionsForClass(this.manager, teacherId, classId);
  }
}

// TypeOrmSessionCommandHandlers.ts
export class TypeOrmSessionCommandHandlers {
  async createManualSession(input: {
    teacherId: number;
    classId: number;
    session: CreateManualSessionInput;
  }): Promise<SessionSummary> {
    return AppDataSource.transaction(async (manager) => {
      const sessions = new TypeOrmSessionWriter(manager);
      const useCase = new CreateSession(sessions);
      return useCase.execute(input);
    });
  }

  async cancelSession(input: {
    teacherId: number;
    sessionId: number;
  }): Promise<SessionSummary> {
    return AppDataSource.transaction(async (manager) => {
      const sessions = new TypeOrmSessionWriter(manager);
      const attendance = new TypeOrmAttendanceWriter(manager);
      const finance = new TypeOrmSessionFinanceService(manager);
      const useCase = new CancelSession(sessions, attendance, finance);
      return useCase.execute({
        ...input,
        cancelledAt: new Date(),
      });
    });
  }
}

// TypeOrmSessionFinanceService.ts
export type SyncAttendanceFeeRecordInput = {
  teacherId: number;
  sessionId: number;
  studentId: number;
  enrollmentId: number;
  amount: string;
  shouldCharge: boolean;
};

const financeFeeSync = new TypeOrmFinanceFeeSync();

export class TypeOrmSessionFinanceService {
  constructor(private readonly manager: EntityManager) {}

  cancelFeeRecordsForSessions(
    teacherId: number,
    sessionIds: number[],
    cancelledAt?: Date,
  ): Promise<void> {
    return financeFeeSync.cancelFeeRecordsForSessions(this.manager, teacherId, sessionIds, cancelledAt).then(() => {});
  }

  syncAttendanceFeeRecord(input: SyncAttendanceFeeRecordInput): Promise<void> {
    return financeFeeSync.syncAttendanceFeeRecord(this.manager, input);
  }
}

// TypeOrmSessionWriter.ts
function sessionWriterEndOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function combineSessionWriterDateWithEndTime(date: Date, endTime: string): Date {
  const [hours, minutes, seconds] = endTime.split(':').map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, seconds, 0);
}

function sessionWriterOverlaps(
  sessionStart: Date,
  sessionEndTime: string,
  candidateStart: Date,
  candidateEndTime: string,
): boolean {
  const sessionEnd = combineSessionWriterDateWithEndTime(sessionStart, sessionEndTime);
  const candidateEnd = combineSessionWriterDateWithEndTime(candidateStart, candidateEndTime);

  return sessionStart < candidateEnd && candidateStart < sessionEnd;
}

export class TypeOrmSessionWriter {
  constructor(private readonly manager: EntityManager) {}

  findById(teacherId: number, sessionId: number): Promise<Session | null> {
    return this.manager.getRepository(Session).findOneBy({
      id: sessionId,
      teacher_id: teacherId,
    });
  }

  findClassById(teacherId: number, classId: number): Promise<Class | null> {
    return this.manager.getRepository(Class).findOneBy({
      id: classId,
      teacher_id: teacherId,
    });
  }

  findByTeacherClassAndScheduledAt(
    teacherId: number,
    classId: number,
    scheduledAt: Date,
  ): Promise<Session | null> {
    return this.manager.getRepository(Session).findOneBy({
      teacher_id: teacherId,
      class_id: classId,
      scheduled_at: scheduledAt,
    });
  }

  async hasOverlappingSession(
    teacherId: number,
    scheduledAt: Date,
    endTime: string,
  ): Promise<boolean> {
    const sessions = await this.manager.getRepository(Session).find({
      where: {
        teacher_id: teacherId,
        scheduled_at: Between(
          new Date(scheduledAt.getFullYear(), scheduledAt.getMonth(), scheduledAt.getDate(), 0, 0, 0, 0),
          sessionWriterEndOfDay(scheduledAt),
        ),
      },
    });

    return sessions.some((session) => (
      !session.isCancelled()
      && session.end_time !== null
      && sessionWriterOverlaps(session.scheduled_at, session.end_time, scheduledAt, endTime)
    ));
  }

  create(input: {
    teacher_id: number;
    class_id: number;
    scheduled_at: Date;
    end_time: string;
    status: Session['status'];
    is_manual: boolean;
    cancelled_at: null;
  }): Session {
    return this.manager.getRepository(Session).create(input);
  }

  save(session: Session): Promise<Session> {
    return this.manager.getRepository(Session).save(session);
  }
}
