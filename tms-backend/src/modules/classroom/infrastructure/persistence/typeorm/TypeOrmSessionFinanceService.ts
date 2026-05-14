import type { EntityManager } from 'typeorm';

import { TypeOrmFinanceFeeSync } from '../../../../finance/index.js';

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
