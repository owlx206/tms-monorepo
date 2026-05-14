import { TypeOrmTransactionReader } from '../../../../finance/index.js';

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

export class TypeOrmFinanceReportReader {
  getFinanceSummary(input: {
    teacherId: number;
    from: Date;
    to: Date;
    includeUnpaid: boolean;
  }): Promise<FinanceSummaryView> {
    return financeReader.getFinanceSummary(input.teacherId, {
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
    return financeReader.listStudentBalances(input.teacherId, {
      status: input.status as never,
      include_pending_archive: input.includePendingArchive,
    }) as Promise<StudentBalanceRow[]>;
  }

  listTransactions(input: {
    teacherId: number;
    studentId: number;
  }): Promise<StudentTransactionListView> {
    return financeReader.listTransactions(input.teacherId, { student_id: input.studentId });
  }
}
