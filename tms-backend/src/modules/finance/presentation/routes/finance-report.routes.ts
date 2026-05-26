import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../account/contracts/types.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import { attachRequestContext } from '../../../../infrastructure/http/request-context.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import { requireRoles } from '../../../../infrastructure/security/rbac.js';
import { FinanceReportController } from '../controllers/FinanceReportController.js';
import { incomeReportQuerySchema } from './finance-report.schema.js';

export function createFinanceReportRouter(controller: FinanceReportController): Router {
  const router = Router();

  router.use(passport.authenticate('jwt', { session: false }));
  router.use(requireRoles([TeacherRole.Teacher]));
  router.use(attachRequestContext());

  router.get(
    '/reporting/income',
    validate({ query: incomeReportQuerySchema }),
    adaptExpressRoute(controller),
  );

  return router;
}
