import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../account/contracts/types.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import { attachRequestContext } from '../../../../infrastructure/http/request-context.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import { authorizeOwnedClasses, authorizeOwnedFeeRecordParam, authorizeOwnedStudentBody, authorizeOwnedStudentQuery, authorizeOwnedTransactionParam } from '../../../../infrastructure/security/ownership.js';
import { requireRoles } from '../../../../infrastructure/security/rbac.js';
import { FinanceController } from '../controllers/FinanceController.js';
import {
  financeIdParamSchema,
  financeFeeRecordListQuerySchema,
  financeSummaryQuerySchema,
  financeTransactionBodySchema,
  financeTransactionListQuerySchema,
  studentBalancesQuerySchema,
  updateFeeRecordStatusBodySchema,
  updateFinanceTransactionBodySchema,
} from './finance.schema.js';

type FinanceRouteControllers = {
  listTransactions: FinanceController;
  createTransaction: FinanceController;
  updateTransaction: FinanceController;
  listTransactionAuditLogs: FinanceController;
  listFeeRecords: FinanceController;
  updateFeeRecordStatus: FinanceController;
  listStudentBalances: FinanceController;
  getFinanceSummary: FinanceController;
};

export function createFinanceRouter(controllers: FinanceRouteControllers): Router {
  const router = Router();

  router.use(
    '/finance',
    passport.authenticate('jwt', { session: false }),
    requireRoles([TeacherRole.Teacher]),
    attachRequestContext(),
  );

  router.get(
    '/finance/transactions',
    validate({ query: financeTransactionListQuerySchema }),
    authorizeOwnedStudentQuery(),
    adaptExpressRoute(controllers.listTransactions),
  );
  router.post(
    '/finance/transactions',
    validate({ body: financeTransactionBodySchema }),
    authorizeOwnedStudentBody('student_id'),
    adaptExpressRoute(controllers.createTransaction),
  );
  router.patch(
    '/finance/transactions/:id',
    validate({ params: financeIdParamSchema, body: updateFinanceTransactionBodySchema }),
    authorizeOwnedTransactionParam('id'),
    authorizeOwnedStudentBody('student_id'),
    adaptExpressRoute(controllers.updateTransaction),
  );
  router.get(
    '/finance/transactions/:id/audit-logs',
    validate({ params: financeIdParamSchema }),
    authorizeOwnedTransactionParam('id'),
    adaptExpressRoute(controllers.listTransactionAuditLogs),
  );
  router.get(
    '/finance/fee-records',
    validate({ query: financeFeeRecordListQuerySchema }),
    authorizeOwnedStudentQuery(),
    adaptExpressRoute(controllers.listFeeRecords),
  );
  router.patch(
    '/finance/fee-records/:id/status',
    validate({ params: financeIdParamSchema, body: updateFeeRecordStatusBodySchema }),
    authorizeOwnedFeeRecordParam('id'),
    adaptExpressRoute(controllers.updateFeeRecordStatus),
  );
  router.get(
    '/finance/balances',
    validate({ query: studentBalancesQuerySchema }),
    adaptExpressRoute(controllers.listStudentBalances),
  );
  router.get(
    '/finance/summary',
    validate({ query: financeSummaryQuerySchema }),
    authorizeOwnedClasses('query', (query) => (query as { class_ids?: number[] } | undefined)?.class_ids),
    adaptExpressRoute(controllers.getFinanceSummary),
  );

  return router;
}
