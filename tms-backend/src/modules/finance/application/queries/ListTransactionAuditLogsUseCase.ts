type FinanceReader = {
  listTransactionAuditLogs(teacherId: number, transactionId: number): Promise<unknown[]>;
};

export class ListTransactionAuditLogsUseCase {
  constructor(private readonly finance: FinanceReader) {}

  execute(teacherId: number, transactionId: number): Promise<unknown[]> {
    return this.finance.listTransactionAuditLogs(teacherId, transactionId);
  }
}
