import { AttendanceSource, AttendanceStatus } from '../../../entities/enums.js';
import { AppDataSource } from '../../../infrastructure/database/data-source.js';
import type { IntervalJob } from '../../../jobs/index.js';
import { ClassServiceError } from '../../../shared/errors/class.error.js';
import { TypeOrmAttendanceWriter } from '../infrastructure/persistence/typeorm/TypeOrmAttendanceWriter.js';
import { TypeOrmSessionFinanceService } from '../infrastructure/persistence/typeorm/TypeOrmSessionFinanceService.js';

type UpdatedSessionRow = {
  id: number;
};

type MaterializeSessionRow = {
  id: number;
  teacher_id: number;
};

function getUpdatedSessionCount(result: unknown): number {
  if (Array.isArray(result) && Array.isArray(result[0]) && typeof result[1] === 'number') {
    return result[1];
  }

  if (Array.isArray(result)) {
    return result.length;
  }

  return 0;
}

async function materializeSessionAttendance(input: {
  attendanceWriter: TypeOrmAttendanceWriter;
  finance: TypeOrmSessionFinanceService;
  teacherId: number;
  sessionId: number;
}): Promise<{
  attendance_created: number;
  fee_records_synced: number;
}> {
  const session = await input.attendanceWriter.findSessionById(input.teacherId, input.sessionId);

  if (!session) {
    throw new ClassServiceError('session not found', 404);
  }

  if (session.isCancelled()) {
    return {
      attendance_created: 0,
      fee_records_synced: 0,
    };
  }

  const classEntity = await input.attendanceWriter.findClassById(input.teacherId, session.class_id);

  if (!classEntity) {
    throw new ClassServiceError('class not found', 404);
  }

  const enrollments = await input.attendanceWriter.findEnrollmentsAtSessionTime(
    input.teacherId,
    session.class_id,
    session.scheduled_at,
  );

  let attendanceCreated = 0;
  let feeRecordsSynced = 0;

  for (const enrollment of enrollments) {
    let attendance = await input.attendanceWriter.findAttendanceForStudent(
      input.teacherId,
      input.sessionId,
      enrollment.student_id,
    );

    if (!attendance) {
      attendance = input.attendanceWriter.create({
        teacher_id: input.teacherId,
        session_id: input.sessionId,
        student_id: enrollment.student_id,
        status: AttendanceStatus.AbsentUnexcused,
        source: AttendanceSource.System,
        overridden_at: null,
        notes: null,
      });
      attendance = await input.attendanceWriter.save(attendance);
      attendanceCreated += 1;
    }

    const shouldCharge = attendance.status === AttendanceStatus.Present
      || attendance.status === AttendanceStatus.AbsentUnexcused;

    await input.finance.syncAttendanceFeeRecord({
      teacherId: input.teacherId,
      sessionId: session.id,
      studentId: enrollment.student_id,
      enrollmentId: enrollment.id,
      amount: classEntity.fee_per_session,
      shouldCharge,
    });
    feeRecordsSynced += 1;
  }

  return {
    attendance_created: attendanceCreated,
    fee_records_synced: feeRecordsSynced,
  };
}

export async function syncSessionStatusesOnce(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    return;
  }

  const materializeRows = await AppDataSource.query(`
    SELECT session.id, session.teacher_id
    FROM sessions AS session
    INNER JOIN classes AS class
      ON class.teacher_id = session.teacher_id
      AND class.id = session.class_id
    WHERE class.status = 'active'::class_status
      AND session.end_time IS NOT NULL
      AND session.status IN ('scheduled'::session_status, 'in_progress'::session_status)
      AND CURRENT_TIMESTAMP >= session.scheduled_at
  `) as MaterializeSessionRow[];

  let attendanceCreated = 0;
  let feeRecordsSynced = 0;
  for (const row of materializeRows) {
    const result = await AppDataSource.transaction(async (manager) => {
      const attendanceWriter = new TypeOrmAttendanceWriter(manager);
      const finance = new TypeOrmSessionFinanceService(manager);

      return materializeSessionAttendance({
        attendanceWriter,
        finance,
        teacherId: Number(row.teacher_id),
        sessionId: Number(row.id),
      });
    });
    attendanceCreated += result.attendance_created;
    feeRecordsSynced += result.fee_records_synced;
  }

  const completedResult = await AppDataSource.query(`
    UPDATE sessions AS session
    SET status = 'completed'::session_status
    FROM classes AS class
    WHERE session.teacher_id = class.teacher_id
      AND session.class_id = class.id
      AND class.status = 'active'::class_status
      AND session.end_time IS NOT NULL
      AND session.status IN ('scheduled'::session_status, 'in_progress'::session_status)
      AND CURRENT_TIMESTAMP >= (session.scheduled_at::date + session.end_time)::timestamptz
    RETURNING session.id
  `) as UpdatedSessionRow[] | [UpdatedSessionRow[], number];

  const startedResult = await AppDataSource.query(`
    UPDATE sessions AS session
    SET status = 'in_progress'::session_status
    FROM classes AS class
    WHERE session.teacher_id = class.teacher_id
      AND session.class_id = class.id
      AND class.status = 'active'::class_status
      AND session.end_time IS NOT NULL
      AND session.status = 'scheduled'::session_status
      AND CURRENT_TIMESTAMP >= session.scheduled_at
      AND CURRENT_TIMESTAMP < (session.scheduled_at::date + session.end_time)::timestamptz
    RETURNING session.id
  `) as UpdatedSessionRow[] | [UpdatedSessionRow[], number];

  const completedCount = getUpdatedSessionCount(completedResult);
  const startedCount = getUpdatedSessionCount(startedResult);

  if (startedCount > 0 || completedCount > 0 || attendanceCreated > 0 || feeRecordsSynced > 0) {
    console.log(
      `[session-status] synced: started=${startedCount}, completed=${completedCount}, attendance_created=${attendanceCreated}, fee_records_synced=${feeRecordsSynced}`,
    );
  }
}

export function createSessionStatusSyncJob(options: {
  enabled: boolean;
  intervalMs: number;
}): IntervalJob {
  return {
    name: 'session-status-sync',
    enabled: options.enabled,
    intervalMs: options.intervalMs,
    run: syncSessionStatusesOnce,
  };
}
