import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../../entities/enums.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import { authorizeOwnedClassBody, authorizeOwnedClassParam, requireRoles } from '../../../identity/index.js';
import { MessagingController } from '../controllers/MessagingController.js';
import {
  bulkDmBodySchema,
  channelPostBodySchema,
  classIdParamSchema,
  messageListQuerySchema,
  serverIdParamSchema,
  upsertCommunityServerBodySchema,
  upsertDiscordServerBodySchema,
} from './messaging.schema.js';

type MessagingRouteControllers = {
  listDiscordServers: MessagingController;
  syncDiscordServers: MessagingController;
  listDiscordChannels: MessagingController;
  completeDiscordInstall: MessagingController;
  getCommunityServer: MessagingController;
  upsertCommunityServer: MessagingController;
  deleteCommunityServer: MessagingController;
  getBotInviteLink: MessagingController;
  getSetupStatus: MessagingController;
  upsertDiscordServer: MessagingController;
  deleteDiscordServer: MessagingController;
  listMessages: MessagingController;
  sendBulkDm: MessagingController;
  sendChannelPost: MessagingController;
};

export function createMessagingRouter(controllers: MessagingRouteControllers): Router {
  const router = Router();

  router.get('/discord/oauth/callback', adaptExpressRoute(controllers.completeDiscordInstall));

  router.use(passport.authenticate('jwt', { session: false }));
  router.use(requireRoles([TeacherRole.Teacher]));

  router.get('/discord/bot-invite-link', adaptExpressRoute(controllers.getBotInviteLink));
  router.get('/discord/setup-status', adaptExpressRoute(controllers.getSetupStatus));
  router.get('/discord/servers', adaptExpressRoute(controllers.listDiscordServers));
  router.post('/discord/servers/sync', adaptExpressRoute(controllers.syncDiscordServers));
  router.get(
    '/discord/servers/:serverId/channels',
    validate({ params: serverIdParamSchema }),
    adaptExpressRoute(controllers.listDiscordChannels),
  );
  router.get('/discord/community-server', adaptExpressRoute(controllers.getCommunityServer));
  router.put(
    '/discord/community-server/select',
    validate({ body: upsertCommunityServerBodySchema }),
    adaptExpressRoute(controllers.upsertCommunityServer),
  );
  router.delete('/discord/community-server', adaptExpressRoute(controllers.deleteCommunityServer));
  router.put(
    '/classes/:classId/discord-server/select',
    validate({ params: classIdParamSchema, body: upsertDiscordServerBodySchema }),
    authorizeOwnedClassParam(),
    adaptExpressRoute(controllers.upsertDiscordServer),
  );
  router.delete(
    '/classes/:classId/discord-server',
    validate({ params: classIdParamSchema }),
    authorizeOwnedClassParam(),
    adaptExpressRoute(controllers.deleteDiscordServer),
  );
  router.get(
    '/discord/messages',
    validate({ query: messageListQuerySchema }),
    adaptExpressRoute(controllers.listMessages),
  );
  router.post(
    '/discord/messages/bulk-dm',
    validate({ body: bulkDmBodySchema }),
    authorizeOwnedClassBody('class_id'),
    adaptExpressRoute(controllers.sendBulkDm),
  );
  router.post(
    '/discord/messages/channel-post',
    validate({ body: channelPostBodySchema }),
    adaptExpressRoute(controllers.sendChannelPost),
  );

  return router;
}
