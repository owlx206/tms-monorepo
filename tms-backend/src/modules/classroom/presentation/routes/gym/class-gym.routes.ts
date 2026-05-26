import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../../account/contracts/types.js';
import { validate } from '../../../../../shared/middlewares/validate.js';
import { attachRequestContext } from '../../../../../infrastructure/http/request-context.js';
import { adaptExpressRoute } from '../../../../../shared/presentation/adapt-express-route.js';
import { authorizeOwnedClassParam, authorizeOwnedGymParam } from '../../../../../infrastructure/security/ownership.js';
import { requireRoles } from '../../../../../infrastructure/security/rbac.js';
import { ClassGymController } from '../../controllers/gym/ClassGymController.js';
import {
  bindClassGymBodySchema,
  classIdParamSchema,
  classGymParamSchema,
  gymListQuerySchema,
} from './class-gym.schema.js';

type ClassGymRouteControllers = {
  listAvailableClassGyms: ClassGymController;
  bindClassGym: ClassGymController;
  unbindClassGym: ClassGymController;
};

export function createClassGymRouter(controllers: ClassGymRouteControllers): Router {
  const router = Router();

  router.use(
    '/classes',
    passport.authenticate('jwt', { session: false }),
    requireRoles([TeacherRole.Teacher]),
    attachRequestContext(),
  );

  router.get(
    '/classes/:classId/available-gyms',
    validate({ params: classIdParamSchema, query: gymListQuerySchema }),
    authorizeOwnedClassParam(),
    adaptExpressRoute(controllers.listAvailableClassGyms),
  );
  router.post(
    '/classes/:classId/gyms',
    validate({ params: classIdParamSchema, body: bindClassGymBodySchema }),
    authorizeOwnedClassParam(),
    adaptExpressRoute(controllers.bindClassGym),
  );
  router.delete(
    '/classes/:classId/gyms/:gymId',
    validate({ params: classGymParamSchema }),
    authorizeOwnedClassParam(),
    authorizeOwnedGymParam(),
    adaptExpressRoute(controllers.unbindClassGym),
  );
  return router;
}
