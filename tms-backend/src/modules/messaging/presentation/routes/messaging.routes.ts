import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../identity/contracts/types.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import { attachRequestContext } from '../../../../infrastructure/http/request-context.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import { authorizeOwnedClassBody, authorizeOwnedClassParam } from '../../../identity/presentation/middlewares/ownership.js';
import { requireRoles } from '../../../identity/presentation/middlewares/rbac.js';
import { MessagingController } from '../controllers/MessagingController.js';
import {
  studentMessageBodySchema,
  channelPostBodySchema,
  classIdParamSchema,
  guildIdParamSchema,
  upsertDiscordGuildBodySchema,
} from './messaging.schema.js';

type MessagingRouteControllers = {
  listDiscordGuilds: MessagingController;
  listDiscordGuildChannels: MessagingController;
  completeDiscordInstall: MessagingController;
  getBotInviteLink: MessagingController;
  getSetupStatus: MessagingController;
  upsertClassDiscordBinding: MessagingController;
  unbindClassDiscordBinding: MessagingController;
  sendStudentMessages: MessagingController;
  sendChannelPost: MessagingController;
};

export function createMessagingRouter(controllers: MessagingRouteControllers): Router {
  const router = Router();
  const publicDiscordCallbacks = Router();

  publicDiscordCallbacks.get('/discord/oauth/callback', adaptExpressRoute(controllers.completeDiscordInstall));
  router.use(publicDiscordCallbacks);

  const teacherAuth = [
    passport.authenticate('jwt', { session: false }),
    requireRoles([TeacherRole.Teacher]),
    attachRequestContext(),
  ];

  router.get('/discord/bot-invite-link', ...teacherAuth, adaptExpressRoute(controllers.getBotInviteLink));
  router.get('/discord/setup-status', ...teacherAuth, adaptExpressRoute(controllers.getSetupStatus));
  router.get('/discord/guilds', ...teacherAuth, adaptExpressRoute(controllers.listDiscordGuilds));
  router.get(
    '/discord/guilds/:guildId/channels',
    ...teacherAuth,
    validate({ params: guildIdParamSchema }),
    adaptExpressRoute(controllers.listDiscordGuildChannels),
  );
  router.put(
    '/classes/:classId/discord-guild/select',
    ...teacherAuth,
    validate({ params: classIdParamSchema, body: upsertDiscordGuildBodySchema }),
    authorizeOwnedClassParam(),
    adaptExpressRoute(controllers.upsertClassDiscordBinding),
  );
  router.delete(
    '/classes/:classId/discord-guild',
    ...teacherAuth,
    validate({ params: classIdParamSchema }),
    authorizeOwnedClassParam(),
    adaptExpressRoute(controllers.unbindClassDiscordBinding),
  );
  router.post(
    '/discord/messages/students',
    ...teacherAuth,
    validate({ body: studentMessageBodySchema }),
    authorizeOwnedClassBody('class_id'),
    adaptExpressRoute(controllers.sendStudentMessages),
  );
  router.post(
    '/discord/messages/channel-post',
    ...teacherAuth,
    validate({ body: channelPostBodySchema }),
    adaptExpressRoute(controllers.sendChannelPost),
  );

  return router;
}
