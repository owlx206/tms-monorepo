import type { AppModule } from '../module.types.js';
import { CreateTransaction } from './application/commands/CreateTransaction.js';
import { UpdateFeeRecordStatus } from './application/commands/UpdateFeeRecordStatus.js';
import { UpdateTransaction } from './application/commands/UpdateTransaction.js';
import { TypeOrmIncomeReportReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmTransactionReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmTransactionWriter } from './infrastructure/persistence/typeorm/Writer.js';
import { FeeRecord } from '../../infrastructure/database/entities/fee-record.entity.js';
import { TransactionAuditLog } from '../../infrastructure/database/entities/transaction-audit-log.entity.js';
import { Transaction } from '../../infrastructure/database/entities/transaction.entity.js';
import { FinanceController } from './presentation/controllers/FinanceController.js';
import { FinanceReportController } from './presentation/controllers/FinanceReportController.js';
import { createFinanceReportRouter } from './presentation/routes/finance-report.routes.js';
import { createFinanceRouter } from './presentation/routes/finance.routes.js';
import { AppDataSource } from '../../infrastructure/database/data-source.js';

const createTransactionWriter = () => new TypeOrmTransactionWriter(AppDataSource.manager);
const financeControllerDependencies = {
  financeReader: {
    listTransactions: (...args: Parameters<TypeOrmTransactionReader['listTransactions']>) =>
      new TypeOrmTransactionReader(AppDataSource.manager).listTransactions(...args),
    listTransactionAuditLogs: (...args: Parameters<TypeOrmTransactionReader['listTransactionAuditLogs']>) =>
      new TypeOrmTransactionReader(AppDataSource.manager).listTransactionAuditLogs(...args),
    listFeeRecords: (...args: Parameters<TypeOrmTransactionReader['listFeeRecords']>) =>
      new TypeOrmTransactionReader(AppDataSource.manager).listFeeRecords(...args),
    listStudentBalances: (...args: Parameters<TypeOrmTransactionReader['listStudentBalances']>) =>
      new TypeOrmTransactionReader(AppDataSource.manager).listStudentBalances(...args),
    getFinanceSummary: (...args: Parameters<TypeOrmTransactionReader['getFinanceSummary']>) =>
      new TypeOrmTransactionReader(AppDataSource.manager).getFinanceSummary(...args),
  },
  createTransaction: {
    execute: (...args: Parameters<CreateTransaction['execute']>) =>
      new CreateTransaction(createTransactionWriter()).execute(...args),
  },
  updateTransaction: {
    execute: (...args: Parameters<UpdateTransaction['execute']>) =>
      new UpdateTransaction(createTransactionWriter()).execute(...args),
  },
  updateFeeRecordStatus: {
    execute: (...args: Parameters<UpdateFeeRecordStatus['execute']>) =>
      new UpdateFeeRecordStatus(createTransactionWriter()).execute(...args),
  },
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
  new FinanceReportController({
    getIncomeReport: (...args: Parameters<TypeOrmIncomeReportReader['getIncomeReport']>) =>
      new TypeOrmIncomeReportReader(AppDataSource.manager).getIncomeReport(...args),
  }),
);

export const financeModule: AppModule = {
  name: 'finance',
  entities: [FeeRecord, Transaction, TransactionAuditLog],
  routes: [
    { path: '/', router: financeRouter },
    { path: '/', router: financeReportRouter },
  ],
};
