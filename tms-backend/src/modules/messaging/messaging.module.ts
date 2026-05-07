import type { AppModule } from '../module.types.js';
import { TypeOrmSysadminDiscordBotCredentialStore } from '../identity/infrastructure/persistence/typeorm/TypeOrmSysadminDiscordBotCredentialStore.js';
import { BindClassDiscordServerUseCase } from './application/commands/BindClassDiscordServerUseCase.js';
import { CompleteDiscordGuildInstallUseCase } from './application/commands/CompleteDiscordGuildInstallUseCase.js';
import { DeleteCommunityServerUseCase } from './application/commands/DeleteCommunityServerUseCase.js';
import { DeleteDiscordServerUseCase } from './application/commands/DeleteDiscordServerUseCase.js';
import { SelectCommunityServerUseCase } from './application/commands/SelectCommunityServerUseCase.js';
import { SendBulkDmUseCase } from './application/commands/SendBulkDmUseCase.js';
import { SendChannelPostUseCase } from './application/commands/SendChannelPostUseCase.js';
import { SyncTeacherDiscordServersUseCase } from './application/commands/SyncTeacherDiscordServersUseCase.js';
import { MessagingReadService } from './application/queries/MessagingReadService.js';
import { StoredDiscordGatewayFactory } from './infrastructure/discord/StoredDiscordGatewayFactory.js';
import { StoredDiscordRecipientResolver } from './infrastructure/discord/StoredDiscordRecipientResolver.js';
import { DiscordMessageRecipientOrmEntity } from './infrastructure/persistence/typeorm/DiscordMessageRecipientOrmEntity.js';
import { DiscordMessageOrmEntity } from './infrastructure/persistence/typeorm/DiscordMessageOrmEntity.js';
import { DiscordServerOrmEntity } from './infrastructure/persistence/typeorm/DiscordServerOrmEntity.js';
import { TeacherDiscordChannelCacheOrmEntity } from './infrastructure/persistence/typeorm/TeacherDiscordChannelCacheOrmEntity.js';
import { TeacherDiscordServerCacheOrmEntity } from './infrastructure/persistence/typeorm/TeacherDiscordServerCacheOrmEntity.js';
import { TeacherCommunityServerOrmEntity } from './infrastructure/persistence/typeorm/TeacherCommunityServerOrmEntity.js';
import { TypeOrmMessagingReadRepository } from './infrastructure/persistence/typeorm/TypeOrmMessagingReadRepository.js';
import { TypeOrmMessagingWriteRepository } from './infrastructure/persistence/typeorm/TypeOrmMessagingWriteRepository.js';
import { MessagingController } from './presentation/controllers/MessagingController.js';
import { createMessagingRouter } from './presentation/routes/messaging.routes.js';

const discordBotCredentialStore = new TypeOrmSysadminDiscordBotCredentialStore();
const messagingReadService = new MessagingReadService(
  new TypeOrmMessagingReadRepository(),
  discordBotCredentialStore,
);
const messagingWriteRepository = new TypeOrmMessagingWriteRepository();
const discordGatewayFactory = new StoredDiscordGatewayFactory(discordBotCredentialStore);
const discordRecipientResolver = new StoredDiscordRecipientResolver(discordBotCredentialStore);
const syncTeacherDiscordServersUseCase = new SyncTeacherDiscordServersUseCase(
  messagingWriteRepository,
  discordGatewayFactory,
  discordBotCredentialStore,
);
const completeDiscordGuildInstallUseCase = new CompleteDiscordGuildInstallUseCase(
  messagingWriteRepository,
  discordGatewayFactory,
  discordBotCredentialStore,
);
const selectCommunityServerUseCase = new SelectCommunityServerUseCase(messagingWriteRepository);
const bindClassDiscordServerUseCase = new BindClassDiscordServerUseCase(messagingWriteRepository);
const deleteCommunityServerUseCase = new DeleteCommunityServerUseCase(messagingWriteRepository);
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
  listDiscordServers: (teacherId: number) => messagingReadService.listTeacherDiscordServers(teacherId),
  syncDiscordServers: (teacherId: number) => syncTeacherDiscordServersUseCase.execute(teacherId),
  completeDiscordInstall: (input: { code?: string; state?: string; guild_id?: string; error?: string }) =>
    completeDiscordGuildInstallUseCase.execute(input),
  listDiscordChannels: async (teacherId: number, serverId: number) => {
    const server = await messagingWriteRepository.findTeacherDiscordServerCacheById(teacherId, serverId);
    if (!server) {
      return [];
    }

    return messagingReadService.listTeacherDiscordChannelsForServer(teacherId, server.discord_server_id);
  },
  getCommunityServer: (teacherId: number) => messagingReadService.getCommunityServer(teacherId),
  upsertCommunityServer: (
    teacherId: number,
    input: Parameters<SelectCommunityServerUseCase['execute']>[1],
  ) => selectCommunityServerUseCase.execute(teacherId, input),
  deleteCommunityServer: (teacherId: number) => deleteCommunityServerUseCase.execute(teacherId),
  getBotInviteLink: (teacherId: number) => messagingReadService.getBotInviteLink(teacherId),
  getSetupStatus: (teacherId: number) => messagingReadService.getSetupStatus(teacherId),
  upsertDiscordServerByClass: (
    teacherId: number,
    classId: number,
    input: Parameters<BindClassDiscordServerUseCase['execute']>[2],
  ) => bindClassDiscordServerUseCase.execute(teacherId, classId, input),
  deleteDiscordServer: (teacherId: number, classId: number) =>
    deleteDiscordServerUseCase.execute(teacherId, classId),
  listMessages: (
    teacherId: number,
    filters: Parameters<MessagingReadService['listMessages']>[1],
  ) => messagingReadService.listMessages(teacherId, filters),
  sendBulkDm: (teacherId: number, input: Parameters<SendBulkDmUseCase['execute']>[1]) =>
    sendBulkDmUseCase.execute(teacherId, input),
  sendChannelPost: (teacherId: number, input: Parameters<SendChannelPostUseCase['execute']>[1]) =>
    sendChannelPostUseCase.execute(teacherId, input),
};

const messagingRouter = createMessagingRouter({
  listDiscordServers: new MessagingController('listDiscordServers', messagingControllerDependencies),
  syncDiscordServers: new MessagingController('syncDiscordServers', messagingControllerDependencies),
  listDiscordChannels: new MessagingController('listDiscordChannels', messagingControllerDependencies),
  completeDiscordInstall: new MessagingController('completeDiscordInstall', messagingControllerDependencies),
  getCommunityServer: new MessagingController('getCommunityServer', messagingControllerDependencies),
  upsertCommunityServer: new MessagingController('upsertCommunityServer', messagingControllerDependencies),
  deleteCommunityServer: new MessagingController('deleteCommunityServer', messagingControllerDependencies),
  getBotInviteLink: new MessagingController('getBotInviteLink', messagingControllerDependencies),
  getSetupStatus: new MessagingController('getSetupStatus', messagingControllerDependencies),
  upsertDiscordServer: new MessagingController('upsertDiscordServer', messagingControllerDependencies),
  deleteDiscordServer: new MessagingController('deleteDiscordServer', messagingControllerDependencies),
  listMessages: new MessagingController('listMessages', messagingControllerDependencies),
  sendBulkDm: new MessagingController('sendBulkDm', messagingControllerDependencies),
  sendChannelPost: new MessagingController('sendChannelPost', messagingControllerDependencies),
});

export const messagingModule: AppModule = {
  name: 'messaging',
  entities: [
    DiscordServerOrmEntity,
    TeacherDiscordServerCacheOrmEntity,
    TeacherDiscordChannelCacheOrmEntity,
    TeacherCommunityServerOrmEntity,
    DiscordMessageOrmEntity,
    DiscordMessageRecipientOrmEntity,
  ],
  routes: [{ path: '/', router: messagingRouter }],
};
