import type { StudentStatus } from '../../../../entities/enums.js';

type FinanceReader = {
  listStudentBalances(
    teacherId: number,
    filters: {
      status?: StudentStatus;
      include_pending_archive?: boolean;
    },
  ): Promise<unknown[]>;
};

export class ListStudentBalancesUseCase {
  constructor(private readonly finance: FinanceReader) {}

  execute(
    teacherId: number,
    filters: {
      status?: StudentStatus;
      include_pending_archive?: boolean;
    },
  ): Promise<unknown[]> {
    return this.finance.listStudentBalances(teacherId, filters);
  }
}
