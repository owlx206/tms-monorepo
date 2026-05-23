import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../../identity/contracts/types.js';
import { validate } from '../../../../../shared/middlewares/validate.js';
import { attachRequestContext } from '../../../../../infrastructure/http/request-context.js';
import { adaptExpressRoute } from '../../../../../shared/presentation/adapt-express-route.js';
import { authorizeOwnedClassParam, authorizeOwnedGymParam } from '../../../../identity/presentation/middlewares/ownership.js';
import { requireRoles } from '../../../../identity/presentation/middlewares/rbac.js';
import { ClassGymStandingReportController } from '../../controllers/gym/ClassGymStandingReportController.js';
import { classGymParamSchema } from './class-gym.schema.js';

export function createClassGymStandingReportRouter(controller: ClassGymStandingReportController): Router {
  const router = Router();

  router.use(passport.authenticate('jwt', { session: false }));
  router.use(requireRoles([TeacherRole.Teacher]));
  router.use(attachRequestContext());

  router.get(
    '/classes/:classId/gyms/:gymId/standing',
    validate({ params: classGymParamSchema }),
    authorizeOwnedClassParam(),
    authorizeOwnedGymParam(),
    adaptExpressRoute(controller),
  );

  return router;
}
