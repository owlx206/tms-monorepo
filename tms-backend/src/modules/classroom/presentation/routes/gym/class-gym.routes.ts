import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../../identity/contracts/types.js';
import { validate } from '../../../../../shared/middlewares/validate.js';
import { attachRequestContext } from '../../../../../infrastructure/http/request-context.js';
import { adaptExpressRoute } from '../../../../../shared/presentation/adapt-express-route.js';
import { authorizeOwnedClassParam, authorizeOwnedStudentBody, authorizeOwnedGymParam } from '../../../../identity/presentation/middlewares/ownership.js';
import { requireRoles } from '../../../../identity/presentation/middlewares/rbac.js';
import { ClassGymController } from '../../controllers/gym/ClassGymController.js';
import {
  addGymProblemBodySchema,
  bindClassGymBodySchema,
  classIdParamSchema,
  classGymParamSchema,
  gymListQuerySchema,
  upsertGymStandingBodySchema,
} from './class-gym.schema.js';

type ClassGymRouteControllers = {
  listAvailableClassGyms: ClassGymController;
  bindClassGym: ClassGymController;
  unbindClassGym: ClassGymController;
  addGymProblem: ClassGymController;
  upsertGymStanding: ClassGymController;
};

export function createClassGymRouter(controllers: ClassGymRouteControllers): Router {
  const router = Router();

  router.use(passport.authenticate('jwt', { session: false }));
  router.use(requireRoles([TeacherRole.Teacher]));
  router.use(attachRequestContext());

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
  router.post(
    '/classes/:classId/gyms/:gymId/problems',
    validate({ params: classGymParamSchema, body: addGymProblemBodySchema }),
    authorizeOwnedClassParam(),
    authorizeOwnedGymParam(),
    adaptExpressRoute(controllers.addGymProblem),
  );
  router.put(
    '/classes/:classId/gyms/:gymId/standings',
    validate({ params: classGymParamSchema, body: upsertGymStandingBodySchema }),
    authorizeOwnedClassParam(),
    authorizeOwnedGymParam(),
    authorizeOwnedStudentBody('student_id'),
    adaptExpressRoute(controllers.upsertGymStanding),
  );

  return router;
}
