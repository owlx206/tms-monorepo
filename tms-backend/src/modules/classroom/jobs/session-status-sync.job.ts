import { In } from 'typeorm';

import { AttendanceSource, AttendanceStatus, ClassStatus, SessionStatus } from '../contracts/types.js';
import { AppDataSource } from '../../../infrastructure/database/data-source.js';
import type { IntervalJob } from '../../../infrastructure/jobs/index.js';
import { HttpError } from '../../../shared/errors/HttpError.js';
import { Class } from '../infrastructure/persistence/typeorm/entities/class.entity.js';
import { Session } from '../infrastructure/persistence/typeorm/entities/session.entity.js';
import { TypeOrmAttendanceWriter } from '../infrastructure/persistence/typeorm/Writer.js';
import { TypeOrmSessionFinanceService } from '../infrastructure/persistence/typeorm/Writer.js';

type UpdatedSessionRow = {
  id: number;
};

type MaterializeSessionRow = {
  id: number;
  teacher_id: number;
};

function getSessionEndAt(session: Pick<Session, 'scheduled_at' | 'end_time'>): Date | null {
  if (!session.end_time) {
    return null;
  }

  const [hours = '0', minutes = '0', seconds = '0'] = session.end_time.split(':');
  const endAt = new Date(session.scheduled_at);
  endAt.setHours(Number(hours), Number(minutes), Number(seconds), 0);
  return endAt;
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
    throw new HttpError('session not found', 404);
  }

  if (session.isCancelled()) {
    return {
      attendance_created: 0,
      fee_records_synced: 0,
    };
  }

  const classEntity = await input.attendanceWriter.findClassById(input.teacherId, session.class_id);

  if (!classEntity) {
    throw new HttpError('class not found', 404);
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

  const activeSessions = await AppDataSource
    .getRepository(Session)
    .createQueryBuilder('session')
    .innerJoin(
      Class,
      'class',
      'class.teacher_id = session.teacher_id AND class.id = session.class_id',
    )
    .where('class.status = :classStatus', { classStatus: ClassStatus.Active })
    .andWhere('session.end_time IS NOT NULL')
    .andWhere('session.status IN (:...statuses)', {
      statuses: [SessionStatus.Scheduled, SessionStatus.InProgress],
    })
    .andWhere('CURRENT_TIMESTAMP >= session.scheduled_at')
    .getMany();

  const materializeRows: MaterializeSessionRow[] = activeSessions.map((session) => ({
    id: session.id,
    teacher_id: session.teacher_id,
  }));

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

  const now = new Date();
  const completedRows: UpdatedSessionRow[] = [];
  const startedRows: UpdatedSessionRow[] = [];

  for (const session of activeSessions) {
    const endAt = getSessionEndAt(session);
    if (!endAt) {
      continue;
    }

    if (now >= endAt) {
      completedRows.push({ id: session.id });
      continue;
    }

    if (session.status === SessionStatus.Scheduled && now >= session.scheduled_at) {
      startedRows.push({ id: session.id });
    }
  }

  if (completedRows.length > 0) {
    await AppDataSource.getRepository(Session).update(
      { id: In(completedRows.map((row) => row.id)) },
      { status: SessionStatus.Completed },
    );
  }

  if (startedRows.length > 0) {
    await AppDataSource.getRepository(Session).update(
      { id: In(startedRows.map((row) => row.id)) },
      { status: SessionStatus.InProgress },
    );
  }

  const completedCount = completedRows.length;
  const startedCount = startedRows.length;

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
