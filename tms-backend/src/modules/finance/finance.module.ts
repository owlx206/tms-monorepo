import type { AppModule } from '../module.types.js';
import { CreateTransactionUseCase } from './application/commands/CreateTransactionUseCase.js';
import { UpdateFeeRecordStatusUseCase } from './application/commands/UpdateFeeRecordStatusUseCase.js';
import { UpdateTransactionUseCase } from './application/commands/UpdateTransactionUseCase.js';
import { GetFinanceSummaryUseCase } from './application/queries/GetFinanceSummaryUseCase.js';
import { GetIncomeReportUseCase } from './application/queries/GetIncomeReportUseCase.js';
import { ListFeeRecordsUseCase } from './application/queries/ListFeeRecordsUseCase.js';
import { ListStudentBalancesUseCase } from './application/queries/ListStudentBalancesUseCase.js';
import { ListTransactionAuditLogsUseCase } from './application/queries/ListTransactionAuditLogsUseCase.js';
import { ListTransactionsUseCase } from './application/queries/ListTransactionsUseCase.js';
import { TypeOrmFeeRecordRepository } from './infrastructure/persistence/typeorm/TypeOrmFeeRecordRepository.js';
import { TypeOrmIncomeReportReader } from './infrastructure/persistence/typeorm/TypeOrmIncomeReportReader.js';
import { TypeOrmTransactionReader } from './infrastructure/persistence/typeorm/TypeOrmTransactionReader.js';
import { TypeOrmTransactionRepository } from './infrastructure/persistence/typeorm/TypeOrmTransactionRepository.js';
import { FeeRecord } from '../../entities/fee-record.entity.js';
import { TransactionAuditLog } from '../../entities/transaction-audit-log.entity.js';
import { Transaction } from '../../entities/transaction.entity.js';
import { FinanceController } from './presentation/controllers/FinanceController.js';
import { FinanceReportController } from './presentation/controllers/FinanceReportController.js';
import { createFinanceReportRouter } from './presentation/routes/finance-report.routes.js';
import { createFinanceRouter } from './presentation/routes/finance.routes.js';

const transactionRepository = new TypeOrmTransactionRepository();
const feeRecordRepository = new TypeOrmFeeRecordRepository();
const financeReader = new TypeOrmTransactionReader();
const listTransactions = new ListTransactionsUseCase(financeReader);
const listTransactionAuditLogs = new ListTransactionAuditLogsUseCase(financeReader);
const listFeeRecords = new ListFeeRecordsUseCase(financeReader);
const listStudentBalances = new ListStudentBalancesUseCase(financeReader);
const getFinanceSummary = new GetFinanceSummaryUseCase(financeReader);
const getIncomeReportUseCase = new GetIncomeReportUseCase(new TypeOrmIncomeReportReader());

const financeRouter = createFinanceRouter({
  listTransactions: new FinanceController('listTransactions', {
    listTransactions,
    listTransactionAuditLogs,
    listFeeRecords,
    listStudentBalances,
    getFinanceSummary,
    createTransaction: new CreateTransactionUseCase(transactionRepository),
    updateTransaction: new UpdateTransactionUseCase(transactionRepository),
    updateFeeRecordStatus: new UpdateFeeRecordStatusUseCase(feeRecordRepository),
  }),
  createTransaction: new FinanceController('createTransaction', {
    listTransactions,
    listTransactionAuditLogs,
    listFeeRecords,
    listStudentBalances,
    getFinanceSummary,
    createTransaction: new CreateTransactionUseCase(transactionRepository),
    updateTransaction: new UpdateTransactionUseCase(transactionRepository),
    updateFeeRecordStatus: new UpdateFeeRecordStatusUseCase(feeRecordRepository),
  }),
  updateTransaction: new FinanceController('updateTransaction', {
    listTransactions,
    listTransactionAuditLogs,
    listFeeRecords,
    listStudentBalances,
    getFinanceSummary,
    createTransaction: new CreateTransactionUseCase(transactionRepository),
    updateTransaction: new UpdateTransactionUseCase(transactionRepository),
    updateFeeRecordStatus: new UpdateFeeRecordStatusUseCase(feeRecordRepository),
  }),
  listTransactionAuditLogs: new FinanceController('listTransactionAuditLogs', {
    listTransactions,
    listTransactionAuditLogs,
    listFeeRecords,
    listStudentBalances,
    getFinanceSummary,
    createTransaction: new CreateTransactionUseCase(transactionRepository),
    updateTransaction: new UpdateTransactionUseCase(transactionRepository),
    updateFeeRecordStatus: new UpdateFeeRecordStatusUseCase(feeRecordRepository),
  }),
  listFeeRecords: new FinanceController('listFeeRecords', {
    listTransactions,
    listTransactionAuditLogs,
    listFeeRecords,
    listStudentBalances,
    getFinanceSummary,
    createTransaction: new CreateTransactionUseCase(transactionRepository),
    updateTransaction: new UpdateTransactionUseCase(transactionRepository),
    updateFeeRecordStatus: new UpdateFeeRecordStatusUseCase(feeRecordRepository),
  }),
  updateFeeRecordStatus: new FinanceController('updateFeeRecordStatus', {
    listTransactions,
    listTransactionAuditLogs,
    listFeeRecords,
    listStudentBalances,
    getFinanceSummary,
    createTransaction: new CreateTransactionUseCase(transactionRepository),
    updateTransaction: new UpdateTransactionUseCase(transactionRepository),
    updateFeeRecordStatus: new UpdateFeeRecordStatusUseCase(feeRecordRepository),
  }),
  listStudentBalances: new FinanceController('listStudentBalances', {
    listTransactions,
    listTransactionAuditLogs,
    listFeeRecords,
    listStudentBalances,
    getFinanceSummary,
    createTransaction: new CreateTransactionUseCase(transactionRepository),
    updateTransaction: new UpdateTransactionUseCase(transactionRepository),
    updateFeeRecordStatus: new UpdateFeeRecordStatusUseCase(feeRecordRepository),
  }),
  getFinanceSummary: new FinanceController('getFinanceSummary', {
    listTransactions,
    listTransactionAuditLogs,
    listFeeRecords,
    listStudentBalances,
    getFinanceSummary,
    createTransaction: new CreateTransactionUseCase(transactionRepository),
    updateTransaction: new UpdateTransactionUseCase(transactionRepository),
    updateFeeRecordStatus: new UpdateFeeRecordStatusUseCase(feeRecordRepository),
  }),
});

const financeReportRouter = createFinanceReportRouter(
  new FinanceReportController(getIncomeReportUseCase),
);

export const financeModule: AppModule = {
  name: 'finance',
  entities: [FeeRecord, Transaction, TransactionAuditLog],
  routes: [
    { path: '/', router: financeRouter },
    { path: '/', router: financeReportRouter },
  ],
};
