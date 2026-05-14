import { ServiceError } from '../../../../shared/errors/service.error.js';
import type { FeeRecordStatus } from '../../../../entities/enums.js';

type FeeRecordFilters = {
  student_id?: number;
  session_id?: number;
  status?: FeeRecordStatus;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
};

type PaginatedResult = {
  items: unknown[];
  total: number;
  limit: number | null;
  offset: number;
};

type FinanceReader = {
  findOwnedStudent(teacherId: number, studentId: number): Promise<boolean>;
  listFeeRecords(teacherId: number, filters: FeeRecordFilters): Promise<PaginatedResult>;
};

export class ListFeeRecordsUseCase {
  constructor(private readonly finance: FinanceReader) {}

  async execute(teacherId: number, filters: FeeRecordFilters): Promise<PaginatedResult> {
    if (filters.from && filters.to && filters.from > filters.to) {
      throw new ServiceError('from must be earlier than or equal to to', 400);
    }

    if (filters.student_id !== undefined) {
      const exists = await this.finance.findOwnedStudent(teacherId, filters.student_id);

      if (!exists) {
        throw new ServiceError('student not found', 404);
      }
    }

    return this.finance.listFeeRecords(teacherId, filters);
  }
}
