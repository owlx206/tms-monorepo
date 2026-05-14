import type { EntityManager } from 'typeorm';

import type { FeeRecordStatus } from '../../../../entities/enums.js';
import { FeeRecord } from '../../../../entities/fee-record.entity.js';
import { AppDataSource } from '../../../../infrastructure/database/data-source.js';
import { ServiceError } from '../../../../shared/errors/service.error.js';

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
      throw new ServiceError('fee record not found', 404);
    }

    if (feeRecord.status === input.status) {
      return feeRecord;
    }

    feeRecord.setStatus(input.status);
    return feeRecordWriter.save(feeRecord);
  }
}
