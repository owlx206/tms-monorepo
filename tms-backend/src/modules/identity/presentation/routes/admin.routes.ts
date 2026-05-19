import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../contracts/types.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import { attachRequestContext } from '../../../../infrastructure/http/request-context.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import { AdminController } from '../controllers/AdminController.js';
import { requireRoles } from '../middlewares/rbac.js';
import {
  teacherIdParamSchema,
  upsertSysadminDiscordBotCredentialBodySchema,
  updateTeacherByAdminBodySchema,
} from './admin.schema.js';

type AdminRouteControllers = {
  listTeachers: AdminController;
  updateTeacher: AdminController;
  getDiscordBotCredential: AdminController;
  upsertDiscordBotCredential: AdminController;
};

export function createAdminRouter(controllers: AdminRouteControllers): Router {
  const router = Router();

  router.use(passport.authenticate('jwt', { session: false }));
  router.use(requireRoles([TeacherRole.SysAdmin]));
  router.use(attachRequestContext());

  router.get('/teachers', adaptExpressRoute(controllers.listTeachers));
  router.get('/discord-bot', adaptExpressRoute(controllers.getDiscordBotCredential));
  router.put(
    '/discord-bot',
    validate({ body: upsertSysadminDiscordBotCredentialBodySchema }),
    adaptExpressRoute(controllers.upsertDiscordBotCredential),
  );
  router.patch(
    '/teachers/:teacherId',
    validate({ params: teacherIdParamSchema, body: updateTeacherByAdminBodySchema }),
    adaptExpressRoute(controllers.updateTeacher),
  );

  return router;
}
