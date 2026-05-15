import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../../entities/enums.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import {
  authorizeOwnedClassBody,
  authorizeOwnedClassParam,
  requireRoles,
} from '../../../identity/index.js';
import { MessagingController } from '../controllers/MessagingController.js';
import {
  studentMessageBodySchema,
  channelPostBodySchema,
  classIdParamSchema,
  serverIdParamSchema,
  upsertDiscordServerBodySchema,
} from './messaging.schema.js';

type MessagingRouteControllers = {
  listDiscordServers: MessagingController;
  listDiscordChannels: MessagingController;
  completeDiscordInstall: MessagingController;
  getBotInviteLink: MessagingController;
  getSetupStatus: MessagingController;
  upsertDiscordServer: MessagingController;
  unbindDiscordServer: MessagingController;
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
  ];

  router.get('/discord/bot-invite-link', ...teacherAuth, adaptExpressRoute(controllers.getBotInviteLink));
  router.get('/discord/setup-status', ...teacherAuth, adaptExpressRoute(controllers.getSetupStatus));
  router.get('/discord/servers', ...teacherAuth, adaptExpressRoute(controllers.listDiscordServers));
  router.get(
    '/discord/servers/:serverId/channels',
    ...teacherAuth,
    validate({ params: serverIdParamSchema }),
    adaptExpressRoute(controllers.listDiscordChannels),
  );
  router.put(
    '/classes/:classId/discord-server/select',
    ...teacherAuth,
    validate({ params: classIdParamSchema, body: upsertDiscordServerBodySchema }),
    authorizeOwnedClassParam(),
    adaptExpressRoute(controllers.upsertDiscordServer),
  );
  router.delete(
    '/classes/:classId/discord-server',
    ...teacherAuth,
    validate({ params: classIdParamSchema }),
    authorizeOwnedClassParam(),
    adaptExpressRoute(controllers.unbindDiscordServer),
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
