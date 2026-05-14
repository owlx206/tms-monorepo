import type { AppModule } from '../module.types.js';
import { createSysadminDiscordBotCredentialStore } from '../identity/index.js';
import { BindClassDiscordServerUseCase } from './application/commands/BindClassDiscordServerUseCase.js';
import { CompleteDiscordGuildInstallUseCase } from './application/commands/CompleteDiscordGuildInstallUseCase.js';
import { CompleteStudentDiscordAuthorizationUseCase } from './application/commands/CompleteStudentDiscordAuthorizationUseCase.js';
import { SendStudentMessagesUseCase } from './application/commands/SendStudentMessagesUseCase.js';
import { SendChannelPostUseCase } from './application/commands/SendChannelPostUseCase.js';
import { StartStudentDiscordAuthorizationUseCase } from './application/commands/StartStudentDiscordAuthorizationUseCase.js';
import { SyncDiscordMembershipUseCase } from './application/commands/SyncDiscordMembershipUseCase.js';
import { SyncTeacherDiscordServersUseCase } from './application/commands/SyncTeacherDiscordServersUseCase.js';
import { GetBotInviteLinkUseCase } from './application/queries/GetBotInviteLinkUseCase.js';
import { GetDiscordSetupStatusUseCase } from './application/queries/GetDiscordSetupStatusUseCase.js';
import { ListTeacherDiscordChannelsUseCase } from './application/queries/ListTeacherDiscordChannelsUseCase.js';
import { ListTeacherDiscordServersUseCase } from './application/queries/ListTeacherDiscordServersUseCase.js';
import { StoredDiscordGateway } from './infrastructure/discord/StoredDiscordGateway.js';
import { StoredDiscordRecipientResolver } from './infrastructure/discord/StoredDiscordRecipientResolver.js';
import { DiscordServer } from '../../entities/discord-server.entity.js';
import { TeacherDiscordChannelCache } from '../../entities/teacher-discord-channel-cache.entity.js';
import { TeacherDiscordServerCache } from '../../entities/teacher-discord-server-cache.entity.js';
import { TypeOrmMessagingReader } from './infrastructure/persistence/typeorm/TypeOrmMessagingReader.js';
import { TypeOrmMessagingWriter } from './infrastructure/persistence/typeorm/TypeOrmMessagingWriter.js';
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
const messagingWriter = new TypeOrmMessagingWriter();
const discordGateway = new StoredDiscordGateway(discordBotCredentialStore);
const discordRecipientResolver = new StoredDiscordRecipientResolver(discordBotCredentialStore);
const syncTeacherDiscordServersUseCase = new SyncTeacherDiscordServersUseCase(
  messagingWriter,
  discordGateway,
  discordBotCredentialStore,
);
const syncDiscordMembershipUseCase = new SyncDiscordMembershipUseCase(
  messagingWriter,
  discordBotCredentialStore,
  syncTeacherDiscordServersUseCase,
);
const completeDiscordGuildInstallUseCase = new CompleteDiscordGuildInstallUseCase(
  messagingWriter,
  discordGateway,
  discordBotCredentialStore,
);
const startStudentDiscordAuthorizationUseCase = new StartStudentDiscordAuthorizationUseCase(
  messagingWriter,
  discordBotCredentialStore,
);
const completeStudentDiscordAuthorizationUseCase = new CompleteStudentDiscordAuthorizationUseCase(
  messagingWriter,
  discordBotCredentialStore,
);
const bindClassDiscordServerUseCase = new BindClassDiscordServerUseCase(messagingWriter);
const sendStudentMessagesUseCase = new SendStudentMessagesUseCase(
  messagingWriter,
  discordGateway,
  discordRecipientResolver,
);
const sendChannelPostUseCase = new SendChannelPostUseCase(
  messagingWriter,
  discordGateway,
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
    const server = await messagingWriter.findTeacherDiscordServerCacheById(teacherId, serverId);
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
  sendStudentMessages: (teacherId: number, input: Parameters<SendStudentMessagesUseCase['execute']>[1]) =>
    sendStudentMessagesUseCase.execute(teacherId, input),
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
  sendStudentMessages: new MessagingController('sendStudentMessages', messagingControllerDependencies),
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
