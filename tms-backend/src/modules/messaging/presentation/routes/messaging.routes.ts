import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../../entities/enums.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import {
  authorizeOwnedClassBody,
  authorizeOwnedClassParam,
  authorizeOwnedStudentParam,
  requireRoles,
} from '../../../identity/index.js';
import { MessagingController } from '../controllers/MessagingController.js';
import {
  bulkDmBodySchema,
  channelPostBodySchema,
  classIdParamSchema,
  serverIdParamSchema,
  studentIdParamSchema,
  upsertDiscordServerBodySchema,
} from './messaging.schema.js';

type MessagingRouteControllers = {
  listDiscordServers: MessagingController;
  syncDiscordServers: MessagingController;
  syncDiscordMembership: MessagingController;
  listDiscordChannels: MessagingController;
  completeDiscordInstall: MessagingController;
  startStudentDiscordAuthorization: MessagingController;
  completeStudentDiscordAuthorization: MessagingController;
  getBotInviteLink: MessagingController;
  getSetupStatus: MessagingController;
  upsertDiscordServer: MessagingController;
  deleteDiscordServer: MessagingController;
  sendBulkDm: MessagingController;
  sendChannelPost: MessagingController;
};

export function createMessagingRouter(controllers: MessagingRouteControllers): Router {
  const router = Router();
  const teacherAuth = [
    passport.authenticate('jwt', { session: false }),
    requireRoles([TeacherRole.Teacher]),
  ];

  router.get('/discord/oauth/callback', adaptExpressRoute(controllers.completeDiscordInstall));
  router.get('/discord/student/callback', adaptExpressRoute(controllers.completeStudentDiscordAuthorization));

  router.get('/discord/bot-invite-link', ...teacherAuth, adaptExpressRoute(controllers.getBotInviteLink));
  router.get('/discord/setup-status', ...teacherAuth, adaptExpressRoute(controllers.getSetupStatus));
  router.get('/discord/servers', ...teacherAuth, adaptExpressRoute(controllers.listDiscordServers));
  router.post('/discord/servers/sync', ...teacherAuth, adaptExpressRoute(controllers.syncDiscordServers));
  router.post('/discord/membership/sync', ...teacherAuth, adaptExpressRoute(controllers.syncDiscordMembership));
  router.get(
    '/students/:studentId/discord/authorization-url',
    ...teacherAuth,
    validate({ params: studentIdParamSchema }),
    authorizeOwnedStudentParam(),
    adaptExpressRoute(controllers.startStudentDiscordAuthorization),
  );
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
    adaptExpressRoute(controllers.deleteDiscordServer),
  );
  router.post(
    '/discord/messages/bulk-dm',
    ...teacherAuth,
    validate({ body: bulkDmBodySchema }),
    authorizeOwnedClassBody('class_id'),
    adaptExpressRoute(controllers.sendBulkDm),
  );
  router.post(
    '/discord/messages/channel-post',
    ...teacherAuth,
    validate({ body: channelPostBodySchema }),
    adaptExpressRoute(controllers.sendChannelPost),
  );

  return router;
}
