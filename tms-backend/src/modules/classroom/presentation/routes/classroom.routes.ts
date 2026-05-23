import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../identity/contracts/types.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import { attachRequestContext } from '../../../../infrastructure/http/request-context.js';
import { authorizeOwnedClassParam } from '../../../identity/presentation/middlewares/ownership.js';
import { requireRoles } from '../../../identity/presentation/middlewares/rbac.js';
import {
  channelPostBodySchema,
  classIdParamSchema,
  classListQuerySchema,
  createClassBodySchema,
  guildIdParamSchema,
  upsertDiscordGuildBodySchema,
  updateClassBodySchema,
} from './classroom.schema.js';
import { ClassController } from '../controllers/ClassController.js';
import { ClassDiscordController } from '../controllers/ClassDiscordController.js';

type ClassroomRouteControllers = {
  listClasses: ClassController;
  getClassById: ClassController;
  getClassDetails: ClassController;
  createClass: ClassController;
  updateClass: ClassController;
  archiveClass: ClassController;
  listDiscordGuilds: ClassDiscordController;
  listDiscordGuildChannels: ClassDiscordController;
  completeDiscordInstall: ClassDiscordController;
  getBotInviteLink: ClassDiscordController;
  upsertClassDiscordBinding: ClassDiscordController;
  unbindClassDiscordBinding: ClassDiscordController;
  sendChannelPost: ClassDiscordController;
};

export function createClassroomRouter(controllers: ClassroomRouteControllers): Router {
  const router = Router();
  const publicDiscordCallbacks = Router();

  publicDiscordCallbacks.get('/discord/oauth/callback', adaptExpressRoute(controllers.completeDiscordInstall));
  router.use(publicDiscordCallbacks);

  router.use(passport.authenticate('jwt', { session: false }));
  router.use(requireRoles([TeacherRole.Teacher]));
  router.use(attachRequestContext());

  router.get('/classes', validate({ query: classListQuerySchema }), adaptExpressRoute(controllers.listClasses));
  router.get('/discord/bot-invite-link', adaptExpressRoute(controllers.getBotInviteLink));
  router.get('/discord/guilds', adaptExpressRoute(controllers.listDiscordGuilds));
  router.get(
    '/discord/guilds/:guildId/channels',
    validate({ params: guildIdParamSchema }),
    adaptExpressRoute(controllers.listDiscordGuildChannels),
  );
  router.post(
    '/discord/messages/channel-post',
    validate({ body: channelPostBodySchema }),
    adaptExpressRoute(controllers.sendChannelPost),
  );
  router.post('/classes', validate({ body: createClassBodySchema }), adaptExpressRoute(controllers.createClass));
  router.get('/classes/:classId/details', validate({ params: classIdParamSchema }), authorizeOwnedClassParam(), adaptExpressRoute(controllers.getClassDetails));
  router.get('/classes/:classId', validate({ params: classIdParamSchema }), authorizeOwnedClassParam(), adaptExpressRoute(controllers.getClassById));
  router.patch('/classes/:classId', validate({
    body: updateClassBodySchema,
    params: classIdParamSchema,
  }), authorizeOwnedClassParam(), adaptExpressRoute(controllers.updateClass));
  router.put(
    '/classes/:classId/discord-guild/select',
    validate({ params: classIdParamSchema, body: upsertDiscordGuildBodySchema }),
    authorizeOwnedClassParam(),
    adaptExpressRoute(controllers.upsertClassDiscordBinding),
  );
  router.delete(
    '/classes/:classId/discord-guild',
    validate({ params: classIdParamSchema }),
    authorizeOwnedClassParam(),
    adaptExpressRoute(controllers.unbindClassDiscordBinding),
  );
  router.post('/classes/:classId/archive', validate({ params: classIdParamSchema }), authorizeOwnedClassParam(), adaptExpressRoute(controllers.archiveClass));
  router.post('/classes/:classId/close', validate({ params: classIdParamSchema }), authorizeOwnedClassParam(), adaptExpressRoute(controllers.archiveClass));

  return router;
}
