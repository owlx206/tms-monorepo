import type { AppModule } from '../module.types.js';
import { createSysadminDiscordBotCredentialStore } from '../identity/index.js';
import { BindClassDiscordServerUseCase } from './application/commands/BindClassDiscordServerUseCase.js';
import { CompleteDiscordGuildInstallUseCase } from './application/commands/CompleteDiscordGuildInstallUseCase.js';
import { CompleteStudentDiscordAuthorizationUseCase } from './application/commands/CompleteStudentDiscordAuthorizationUseCase.js';
import { DeleteDiscordServerUseCase } from './application/commands/DeleteDiscordServerUseCase.js';
import { SendBulkDmUseCase } from './application/commands/SendBulkDmUseCase.js';
import { SendChannelPostUseCase } from './application/commands/SendChannelPostUseCase.js';
import { StartStudentDiscordAuthorizationUseCase } from './application/commands/StartStudentDiscordAuthorizationUseCase.js';
import { SyncDiscordMembershipUseCase } from './application/commands/SyncDiscordMembershipUseCase.js';
import { SyncTeacherDiscordServersUseCase } from './application/commands/SyncTeacherDiscordServersUseCase.js';
import { GetBotInviteLinkUseCase } from './application/queries/GetBotInviteLinkUseCase.js';
import { GetDiscordSetupStatusUseCase } from './application/queries/GetDiscordSetupStatusUseCase.js';
import { ListTeacherDiscordChannelsUseCase } from './application/queries/ListTeacherDiscordChannelsUseCase.js';
import { ListTeacherDiscordServersUseCase } from './application/queries/ListTeacherDiscordServersUseCase.js';
import { StoredDiscordGatewayFactory } from './infrastructure/discord/StoredDiscordGatewayFactory.js';
import { StoredDiscordRecipientResolver } from './infrastructure/discord/StoredDiscordRecipientResolver.js';
import { DiscordServer } from '../../entities/discord-server.entity.js';
import { TeacherDiscordChannelCache } from '../../entities/teacher-discord-channel-cache.entity.js';
import { TeacherDiscordServerCache } from '../../entities/teacher-discord-server-cache.entity.js';
import { TypeOrmMessagingReader } from './infrastructure/persistence/typeorm/TypeOrmMessagingReader.js';
import { TypeOrmMessagingWriteRepository } from './infrastructure/persistence/typeorm/TypeOrmMessagingWriteRepository.js';
import { MessagingController } from './presentation/controllers/MessagingController.js';
import { createMessagingRouter } from './presentation/routes/messaging.routes.js';

const discordBotCredentialStore = createSysadminDiscordBotCredentialStore();
const messagingReader = new TypeOrmMessagingReader();
const listTeacherDiscordServersUseCase = new ListTeacherDiscordServersUseCase(messagingReader);
const listTeacherDiscordChannelsUseCase = new ListTeacherDiscordChannelsUseCase(messagingReader);
const getBotInviteLinkUseCase = new GetBotInviteLinkUseCase(discordBotCredentialStore);
const getDiscordSetupStatusUseCase = new GetDiscordSetupStatusUseCase(
  messagingReader,
  discordBotCredentialStore,
  getBotInviteLinkUseCase,
);
const messagingWriteRepository = new TypeOrmMessagingWriteRepository();
const discordGatewayFactory = new StoredDiscordGatewayFactory(discordBotCredentialStore);
const discordRecipientResolver = new StoredDiscordRecipientResolver(discordBotCredentialStore);
const syncTeacherDiscordServersUseCase = new SyncTeacherDiscordServersUseCase(
  messagingWriteRepository,
  discordGatewayFactory,
  discordBotCredentialStore,
);
const syncDiscordMembershipUseCase = new SyncDiscordMembershipUseCase(
  messagingWriteRepository,
  discordBotCredentialStore,
  syncTeacherDiscordServersUseCase,
);
const completeDiscordGuildInstallUseCase = new CompleteDiscordGuildInstallUseCase(
  messagingWriteRepository,
  discordGatewayFactory,
  discordBotCredentialStore,
);
const startStudentDiscordAuthorizationUseCase = new StartStudentDiscordAuthorizationUseCase(
  messagingWriteRepository,
  discordBotCredentialStore,
);
const completeStudentDiscordAuthorizationUseCase = new CompleteStudentDiscordAuthorizationUseCase(
  messagingWriteRepository,
  discordBotCredentialStore,
);
const bindClassDiscordServerUseCase = new BindClassDiscordServerUseCase(messagingWriteRepository);
const deleteDiscordServerUseCase = new DeleteDiscordServerUseCase(messagingWriteRepository);
const sendBulkDmUseCase = new SendBulkDmUseCase(
  messagingWriteRepository,
  discordGatewayFactory,
  discordRecipientResolver,
);
const sendChannelPostUseCase = new SendChannelPostUseCase(
  messagingWriteRepository,
  discordGatewayFactory,
);
const messagingControllerDependencies = {
  listDiscordServers: (teacherId: number) => listTeacherDiscordServersUseCase.execute(teacherId),
  syncDiscordServers: (teacherId: number) => syncTeacherDiscordServersUseCase.execute(teacherId),
  syncDiscordMembership: (teacherId: number) => syncDiscordMembershipUseCase.execute(teacherId),
  completeDiscordInstall: (input: { code?: string; state?: string; guild_id?: string; error?: string }) =>
    completeDiscordGuildInstallUseCase.execute(input),
  startStudentDiscordAuthorization: (teacherId: number, studentId: number) =>
    startStudentDiscordAuthorizationUseCase.execute(teacherId, studentId),
  completeStudentDiscordAuthorization: (input: { code?: string; state?: string; error?: string }) =>
    completeStudentDiscordAuthorizationUseCase.execute(input),
  listDiscordChannels: async (teacherId: number, serverId: number) => {
    const server = await messagingWriteRepository.findTeacherDiscordServerCacheById(teacherId, serverId);
    if (!server) {
      return [];
    }

    return listTeacherDiscordChannelsUseCase.execute(teacherId, server.discord_server_id);
  },
  getBotInviteLink: (teacherId: number) => getBotInviteLinkUseCase.execute(teacherId),
  getSetupStatus: (teacherId: number) => getDiscordSetupStatusUseCase.execute(teacherId),
  upsertDiscordServerByClass: (
    teacherId: number,
    classId: number,
    input: Parameters<BindClassDiscordServerUseCase['execute']>[2],
  ) => bindClassDiscordServerUseCase.execute(teacherId, classId, input),
  deleteDiscordServer: (teacherId: number, classId: number) =>
    deleteDiscordServerUseCase.execute(teacherId, classId),
  sendBulkDm: (teacherId: number, input: Parameters<SendBulkDmUseCase['execute']>[1]) =>
    sendBulkDmUseCase.execute(teacherId, input),
  sendChannelPost: (teacherId: number, input: Parameters<SendChannelPostUseCase['execute']>[1]) =>
    sendChannelPostUseCase.execute(teacherId, input),
};

const messagingRouter = createMessagingRouter({
  listDiscordServers: new MessagingController('listDiscordServers', messagingControllerDependencies),
  syncDiscordServers: new MessagingController('syncDiscordServers', messagingControllerDependencies),
  syncDiscordMembership: new MessagingController('syncDiscordMembership', messagingControllerDependencies),
  listDiscordChannels: new MessagingController('listDiscordChannels', messagingControllerDependencies),
  completeDiscordInstall: new MessagingController('completeDiscordInstall', messagingControllerDependencies),
  startStudentDiscordAuthorization: new MessagingController(
    'startStudentDiscordAuthorization',
    messagingControllerDependencies,
  ),
  completeStudentDiscordAuthorization: new MessagingController(
    'completeStudentDiscordAuthorization',
    messagingControllerDependencies,
  ),
  getBotInviteLink: new MessagingController('getBotInviteLink', messagingControllerDependencies),
  getSetupStatus: new MessagingController('getSetupStatus', messagingControllerDependencies),
  upsertDiscordServer: new MessagingController('upsertDiscordServer', messagingControllerDependencies),
  deleteDiscordServer: new MessagingController('deleteDiscordServer', messagingControllerDependencies),
  sendBulkDm: new MessagingController('sendBulkDm', messagingControllerDependencies),
  sendChannelPost: new MessagingController('sendChannelPost', messagingControllerDependencies),
});

export const messagingModule: AppModule = {
  name: 'messaging',
  entities: [
    DiscordServer,
    TeacherDiscordServerCache,
    TeacherDiscordChannelCache,
  ],
  routes: [{ path: '/', router: messagingRouter }],
};
