import { Router } from 'express';
import passport from 'passport';

import { validate } from '../../../../shared/middlewares/validate.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import { authorizeOwnedStudentParam } from '../middlewares/ownership.js';
import { AuthController } from '../controllers/AuthController.js';
import { loginBodySchema, registerBodySchema, studentIdParamSchema, updateMeBodySchema } from './auth.schema.js';

type AuthRouteControllers = {
  register: AuthController;
  login: AuthController;
  me: AuthController;
  updateMe: AuthController;
  startDiscordVerification: AuthController;
  completeDiscordVerification: AuthController;
  startStudentDiscordAuthorization: AuthController;
  completeStudentDiscordAuthorization: AuthController;
};

export function createAuthRouter(controllers: AuthRouteControllers): Router {
  const router = Router();

  router.post('/register', validate({ body: registerBodySchema }), adaptExpressRoute(controllers.register));
  router.post('/login', validate({ body: loginBodySchema }), adaptExpressRoute(controllers.login));
  router.get('/discord/verification/callback', adaptExpressRoute(controllers.completeDiscordVerification));
  router.get('/discord/student/callback', adaptExpressRoute(controllers.completeStudentDiscordAuthorization));
  router.get('/me', passport.authenticate('jwt', { session: false }), adaptExpressRoute(controllers.me));
  router.get(
    '/students/:studentId/discord/authorization-url',
    passport.authenticate('jwt', { session: false }),
    validate({ params: studentIdParamSchema }),
    authorizeOwnedStudentParam(),
    adaptExpressRoute(controllers.startStudentDiscordAuthorization),
  );
  router.get(
    '/me/discord/verification/start',
    passport.authenticate('jwt', { session: false }),
    adaptExpressRoute(controllers.startDiscordVerification),
  );
  router.patch(
    '/me',
    passport.authenticate('jwt', { session: false }),
    validate({ body: updateMeBodySchema }),
    adaptExpressRoute(controllers.updateMe),
  );

  return router;
}
