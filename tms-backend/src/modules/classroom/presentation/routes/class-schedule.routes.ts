import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../account/contracts/types.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import { attachRequestContext } from '../../../../infrastructure/http/request-context.js';
import { authorizeOwnedClassParam } from '../../../../infrastructure/security/ownership.js';
import { requireRoles } from '../../../../infrastructure/security/rbac.js';
import {
  classIdParamSchema,
} from './classroom.schema.js';
import { ClassScheduleController } from '../controllers/ClassScheduleController.js';

type ScheduleRouteControllers = {
  listClassSchedules: ClassScheduleController;
};

export function createClassScheduleRouter(controllers: ScheduleRouteControllers): Router {
  const router = Router();

  router.use(
    '/classes',
    passport.authenticate('jwt', { session: false }),
    requireRoles([TeacherRole.Teacher]),
    attachRequestContext(),
  );

  router.get('/classes/:classId/schedules', validate({ params: classIdParamSchema }), authorizeOwnedClassParam(), adaptExpressRoute(controllers.listClassSchedules));

  return router;
}
