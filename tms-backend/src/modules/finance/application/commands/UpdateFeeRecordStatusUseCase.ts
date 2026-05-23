import type { FeeRecordStatus } from '../../contracts/types.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { TypeOrmTransactionWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

export class UpdateFeeRecordStatusUseCase {
  constructor(private readonly financeWriter: TypeOrmTransactionWriter) {}

  async execute(input: {
    teacherId: number;
    feeRecordId: number;
    status: FeeRecordStatus;
  }) {
    const feeRecord = await this.financeWriter.updateFeeRecordStatus(input);

    if (!feeRecord) {
      throw new HttpError('fee record not found', 404);
    }

    return feeRecord;
  }
}
