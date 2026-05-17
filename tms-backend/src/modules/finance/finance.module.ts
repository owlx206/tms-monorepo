import type { AppModule } from '../module.types.js';
import { CreateTransactionUseCase } from './application/commands/CreateTransactionUseCase.js';
import { UpdateFeeRecordStatusUseCase } from './application/commands/UpdateFeeRecordStatusUseCase.js';
import { UpdateTransactionUseCase } from './application/commands/UpdateTransactionUseCase.js';
import { TypeOrmIncomeReportReader } from './infrastructure/persistence/typeorm/TypeOrmIncomeReportReader.js';
import { TypeOrmTransactionReader } from './infrastructure/persistence/typeorm/TypeOrmTransactionReader.js';
import { TypeOrmTransactionWriter } from './infrastructure/persistence/typeorm/TypeOrmTransactionWriter.js';
import { FeeRecord } from '../../entities/tuition-fee.entity.js';
import { TransactionAuditLog } from '../../entities/transaction-audit-log.entity.js';
import { Transaction } from '../../entities/transaction.entity.js';
import { FinanceController } from './presentation/controllers/FinanceController.js';
import { FinanceReportController } from './presentation/controllers/FinanceReportController.js';
import { createFinanceReportRouter } from './presentation/routes/finance-report.routes.js';
import { createFinanceRouter } from './presentation/routes/finance.routes.js';

const transactionWriter = new TypeOrmTransactionWriter();
const financeReader = new TypeOrmTransactionReader();
const financeControllerDependencies = {
  financeReader,
  createTransaction: new CreateTransactionUseCase(transactionWriter),
  updateTransaction: new UpdateTransactionUseCase(transactionWriter),
  updateFeeRecordStatus: new UpdateFeeRecordStatusUseCase(),
};

const createFinanceController = (action: ConstructorParameters<typeof FinanceController>[0]) => (
  new FinanceController(action, financeControllerDependencies)
);

const financeRouter = createFinanceRouter({
  listTransactions: createFinanceController('listTransactions'),
  createTransaction: createFinanceController('createTransaction'),
  updateTransaction: createFinanceController('updateTransaction'),
  listTransactionAuditLogs: createFinanceController('listTransactionAuditLogs'),
  listFeeRecords: createFinanceController('listFeeRecords'),
  updateFeeRecordStatus: createFinanceController('updateFeeRecordStatus'),
  listStudentBalances: createFinanceController('listStudentBalances'),
  getFinanceSummary: createFinanceController('getFinanceSummary'),
});

const financeReportRouter = createFinanceReportRouter(
  new FinanceReportController(new TypeOrmIncomeReportReader()),
);

export const financeModule: AppModule = {
  name: 'finance',
  entities: [FeeRecord, Transaction, TransactionAuditLog],
  routes: [
    { path: '/', router: financeRouter },
    { path: '/', router: financeReportRouter },
  ],
};
