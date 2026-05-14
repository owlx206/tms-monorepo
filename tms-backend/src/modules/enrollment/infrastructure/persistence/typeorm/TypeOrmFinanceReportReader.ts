import {
  GetFinanceSummaryUseCase,
  ListStudentBalancesUseCase,
  ListTransactionsUseCase,
  TypeOrmTransactionReader,
} from '../../../../finance/index.js';

export type StudentBalanceRow = {
  balance: string;
};

export type FinanceSummaryView = {
  net_revenue: string;
};

export type StudentTransactionListView = {
  items: unknown[];
};

const financeReader = new TypeOrmTransactionReader();
const getFinanceSummary = new GetFinanceSummaryUseCase(financeReader);
const listStudentBalances = new ListStudentBalancesUseCase(financeReader);
const listTransactions = new ListTransactionsUseCase(financeReader);

export class TypeOrmFinanceReportReader {
  getFinanceSummary(input: {
    teacherId: number;
    from: Date;
    to: Date;
    includeUnpaid: boolean;
  }): Promise<FinanceSummaryView> {
    return getFinanceSummary.execute(input.teacherId, {
      from: input.from,
      to: input.to,
      include_unpaid: input.includeUnpaid,
    });
  }

  listStudentBalances(input: {
    teacherId: number;
    status: string;
    includePendingArchive: boolean;
  }): Promise<StudentBalanceRow[]> {
    return listStudentBalances.execute(input.teacherId, {
      status: input.status as never,
      include_pending_archive: input.includePendingArchive,
    }) as Promise<StudentBalanceRow[]>;
  }

  listTransactions(input: {
    teacherId: number;
    studentId: number;
  }): Promise<StudentTransactionListView> {
    return listTransactions.execute(input.teacherId, { student_id: input.studentId });
  }
}
