import { Router } from 'express';
import passport from 'passport';

import type { AppModule } from '../module.types.js';
import { TeacherRole } from '../account/contracts/types.js';
import { CreateTransaction } from './application/commands/CreateTransaction.js';
import { UpdateFeeRecordStatus } from './application/commands/UpdateFeeRecordStatus.js';
import { UpdateTransaction } from './application/commands/UpdateTransaction.js';
import { TypeOrmIncomeReportReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmTransactionReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmTransactionWriter } from './infrastructure/persistence/typeorm/Writer.js';
import { FeeRecord } from '../../infrastructure/database/entities/fee-record.entity.js';
import { Transaction } from '../../infrastructure/database/entities/transaction.entity.js';
import {
  CreateTransactionController,
  GetFinanceSummaryController,
  ListFeeRecordsController,
  ListStudentBalancesController,
  ListTransactionsController,
  UpdateFeeRecordStatusController,
  UpdateTransactionController,
} from './presentation/controllers/FinanceController.js';
import { FinanceReportController } from './presentation/controllers/FinanceReportController.js';
import { incomeReportQuerySchema } from './presentation/routes/finance-report.schema.js';
import {
  financeFeeRecordListQuerySchema,
  financeIdParamSchema,
  financeSummaryQuerySchema,
  financeTransactionBodySchema,
  financeTransactionListQuerySchema,
  studentBalancesQuerySchema,
  updateFeeRecordStatusBodySchema,
  updateFinanceTransactionBodySchema,
} from './presentation/routes/finance.schema.js';
import { attachRequestContext } from '../../infrastructure/http/request-context.js';
import { authorizeOwnedClasses, authorizeOwnedFeeRecordParam, authorizeOwnedStudentBody, authorizeOwnedStudentQuery, authorizeOwnedTransactionParam } from '../../infrastructure/security/ownership.js';
import { requireRoles } from '../../infrastructure/security/rbac.js';
import { adaptExpressRoute } from '../../shared/presentation/adapt-express-route.js';
import { validate } from '../../shared/middlewares/validate.js';

const transactionReader = new TypeOrmTransactionReader();
const incomeReportReader = new TypeOrmIncomeReportReader();
const transactionWriter = new TypeOrmTransactionWriter();
const createTransaction = new CreateTransaction(transactionWriter);
const updateTransaction = new UpdateTransaction(transactionWriter);
const updateFeeRecordStatus = new UpdateFeeRecordStatus(transactionWriter);

const listTransactionsController = new ListTransactionsController(transactionReader);
const createTransactionController = new CreateTransactionController(createTransaction);
const updateTransactionController = new UpdateTransactionController(updateTransaction);
const listFeeRecordsController = new ListFeeRecordsController(transactionReader);
const updateFeeRecordStatusController = new UpdateFeeRecordStatusController(updateFeeRecordStatus);
const listStudentBalancesController = new ListStudentBalancesController(transactionReader);
const getFinanceSummaryController = new GetFinanceSummaryController(transactionReader);
const incomeReportController = new FinanceReportController(incomeReportReader);

const financeRouter = Router();
financeRouter.use(
  passport.authenticate('jwt', { session: false }),
  requireRoles([TeacherRole.Teacher]),
  attachRequestContext(),
);

financeRouter.get(
  '/transactions',
  validate({ query: financeTransactionListQuerySchema }),
  authorizeOwnedStudentQuery(),
  adaptExpressRoute(listTransactionsController),
);
financeRouter.post(
  '/transactions',
  validate({ body: financeTransactionBodySchema }),
  authorizeOwnedStudentBody('student_id'),
  adaptExpressRoute(createTransactionController),
);
financeRouter.patch(
  '/transactions/:id',
  validate({ params: financeIdParamSchema, body: updateFinanceTransactionBodySchema }),
  authorizeOwnedTransactionParam('id'),
  authorizeOwnedStudentBody('student_id'),
  adaptExpressRoute(updateTransactionController),
);
financeRouter.get(
  '/fee-records',
  validate({ query: financeFeeRecordListQuerySchema }),
  authorizeOwnedStudentQuery(),
  adaptExpressRoute(listFeeRecordsController),
);
financeRouter.patch(
  '/fee-records/:id/status',
  validate({ params: financeIdParamSchema, body: updateFeeRecordStatusBodySchema }),
  authorizeOwnedFeeRecordParam('id'),
  adaptExpressRoute(updateFeeRecordStatusController),
);
financeRouter.get(
  '/balances',
  validate({ query: studentBalancesQuerySchema }),
  adaptExpressRoute(listStudentBalancesController),
);
financeRouter.get(
  '/summary',
  validate({ query: financeSummaryQuerySchema }),
  authorizeOwnedClasses('query', (query) => (query as { class_ids?: number[] } | undefined)?.class_ids),
  adaptExpressRoute(getFinanceSummaryController),
);
financeRouter.get(
  '/reporting/income',
  validate({ query: incomeReportQuerySchema }),
  adaptExpressRoute(incomeReportController),
);

export const financeModule: AppModule = {
  name: 'finance',
  entities: [FeeRecord, Transaction],
  routes: [
    { path: '/finance', router: financeRouter },
  ],
};
