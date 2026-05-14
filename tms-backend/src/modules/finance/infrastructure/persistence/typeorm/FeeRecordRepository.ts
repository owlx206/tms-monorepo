import type { FeeRecord } from '../../../../../entities/fee-record.entity.js';

export interface FeeRecordRepository {
  findOwnedFeeRecord(teacherId: number, feeRecordId: number): Promise<FeeRecord | null>;
  save(feeRecord: FeeRecord): Promise<FeeRecord>;
}
