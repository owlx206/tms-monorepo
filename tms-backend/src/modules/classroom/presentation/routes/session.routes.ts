import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../account/contracts/types.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import { attachRequestContext } from '../../../../infrastructure/http/request-context.js';
import { authorizeOwnedClassParam, authorizeOwnedClassQuery, authorizeOwnedSessionParam } from '../../../../infrastructure/security/ownership.js';
import { requireRoles } from '../../../../infrastructure/security/rbac.js';
import {
  classIdParamSchema,
  createManualSessionBodySchema,
  sessionIdParamSchema,
  sessionListQuerySchema,
} from './classroom.schema.js';
import { SessionController } from '../controllers/SessionController.js';

type SessionRouteControllers = {
  listSessions: SessionController;
  listClassSessions: SessionController;
  createManualSession: SessionController;
  cancelSession: SessionController;
};

export function createSessionRouter(controllers: SessionRouteControllers): Router {
  const router = Router();

  const requireTeacherAuth = [
    passport.authenticate('jwt', { session: false }),
    requireRoles([TeacherRole.Teacher]),
    attachRequestContext(),
  ];
  router.use('/sessions', ...requireTeacherAuth);
  router.use('/classes', ...requireTeacherAuth);

  router.get('/sessions', validate({ query: sessionListQuerySchema }), authorizeOwnedClassQuery(), adaptExpressRoute(controllers.listSessions));
  router.get('/classes/:classId/sessions', validate({
    params: classIdParamSchema,
    query: sessionListQuerySchema,
  }), authorizeOwnedClassParam(), adaptExpressRoute(controllers.listClassSessions));
  router.post('/classes/:classId/sessions/manual', validate({
    body: createManualSessionBodySchema,
    params: classIdParamSchema,
  }), authorizeOwnedClassParam(), adaptExpressRoute(controllers.createManualSession));
  router.post('/sessions/:sessionId/cancel', validate({ params: sessionIdParamSchema }), authorizeOwnedSessionParam(), adaptExpressRoute(controllers.cancelSession));

  return router;
}
