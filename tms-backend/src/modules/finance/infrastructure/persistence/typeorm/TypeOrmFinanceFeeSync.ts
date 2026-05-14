import type { EntityManager } from 'typeorm';

import {
  createFeeRecord,
  findActiveFeeRecordsBySessionIds,
  findFeeRecordForAttendance,
  saveFeeRecord,
  saveFeeRecords,
} from './FeeRecordSyncDataAccess.js';

export class TypeOrmFinanceFeeSync {
  async syncAttendanceFeeRecord(
    manager: EntityManager,
    input: {
      teacherId: number;
      sessionId: number;
      studentId: number;
      enrollmentId: number;
      amount: string;
      shouldCharge: boolean;
      cancelledAt?: Date;
    },
  ): Promise<void> {
    const existing = await findFeeRecordForAttendance(
      manager,
      input.teacherId,
      input.sessionId,
      input.studentId,
    );

    if (!input.shouldCharge) {
      if (existing && !existing.isCancelled()) {
        existing.cancel(input.cancelledAt ?? new Date());
        await saveFeeRecord(manager, existing);
      }

      return;
    }

    if (!existing) {
      const feeRecord = createFeeRecord(manager, {
        teacher_id: input.teacherId,
        student_id: input.studentId,
        session_id: input.sessionId,
        enrollment_id: input.enrollmentId,
        amount: input.amount,
      });

      await saveFeeRecord(manager, feeRecord);
      return;
    }

    existing.activate({
      enrollment_id: input.enrollmentId,
      amount: input.amount,
    });
    await saveFeeRecord(manager, existing);
  }

  async cancelFeeRecordsForSessions(
    manager: EntityManager,
    teacherId: number,
    sessionIds: number[],
    cancelledAt: Date = new Date(),
  ): Promise<number> {
    const feeRecords = await findActiveFeeRecordsBySessionIds(manager, teacherId, sessionIds);

    if (feeRecords.length === 0) {
      return 0;
    }

    feeRecords.forEach((feeRecord) => {
      feeRecord.cancel(cancelledAt);
    });

    await saveFeeRecords(manager, feeRecords);
    return feeRecords.length;
  }
}
