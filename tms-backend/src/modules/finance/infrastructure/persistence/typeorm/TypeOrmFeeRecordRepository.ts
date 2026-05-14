import { type EntityManager } from 'typeorm';

import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import type { FeeRecordRepository } from './FeeRecordRepository.js';
import { FeeRecord } from '../../../../../entities/fee-record.entity.js';

export class TypeOrmFeeRecordRepository implements FeeRecordRepository {
  constructor(private readonly manager: EntityManager = AppDataSource.manager) {}

  findOwnedFeeRecord(teacherId: number, feeRecordId: number) {
    return this.manager.getRepository(FeeRecord).findOneBy({
      id: feeRecordId,
      teacher_id: teacherId,
    });
  }

  save(feeRecord: FeeRecord) {
    return this.manager.getRepository(FeeRecord).save(feeRecord);
  }
}
