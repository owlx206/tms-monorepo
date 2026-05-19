import type { EntityManager } from 'typeorm';

import type { FeeRecordStatus } from '../../contracts/types.js';
import { FeeRecord } from '../../infrastructure/persistence/typeorm/entities/fee-record.entity.js';
import { AppDataSource } from '../../../../infrastructure/database/data-source.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';

export class UpdateFeeRecordStatusUseCase {
  constructor(private readonly manager: EntityManager = AppDataSource.manager) {}

  async execute(input: {
    teacherId: number;
    feeRecordId: number;
    status: FeeRecordStatus;
  }) {
    const feeRecordWriter = this.manager.getRepository(FeeRecord);
    const feeRecord = await feeRecordWriter.findOneBy({
      id: input.feeRecordId,
      teacher_id: input.teacherId,
    });

    if (!feeRecord) {
      throw new HttpError('fee record not found', 404);
    }

    if (feeRecord.status === input.status) {
      return feeRecord;
    }

    feeRecord.setStatus(input.status);
    return feeRecordWriter.save(feeRecord);
  }
}
