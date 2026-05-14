import { AppDataSource } from '../../../../infrastructure/database/data-source.js';
import { MaterializeSessionAttendanceUseCase } from '../commands/MaterializeSessionAttendanceUseCase.js';
import { TypeOrmAttendanceRepository } from '../../infrastructure/persistence/typeorm/TypeOrmAttendanceRepository.js';
import { TypeOrmSessionFinanceService } from '../../infrastructure/persistence/typeorm/TypeOrmSessionFinanceService.js';

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

export class SyncSessionStatusesUseCase {
  async execute(): Promise<void> {
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
        const attendanceRepository = new TypeOrmAttendanceRepository(manager);
        const finance = new TypeOrmSessionFinanceService(manager);
        const useCase = new MaterializeSessionAttendanceUseCase(attendanceRepository, finance);

        return useCase.execute({
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
}
