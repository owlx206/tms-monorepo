import type { AppModule } from '../module.types.js';
import { createSysadminDiscordBotCredentialStore } from '../identity/index.js';
import { BindClassDiscordServerUseCase } from './application/commands/BindClassDiscordServerUseCase.js';
import { UnbindClassDiscordServerUseCase } from './application/commands/UnbindClassDiscordServerUseCase.js';
import { CompleteDiscordGuildInstallUseCase } from '../identity/application/commands/CompleteDiscordGuildInstallUseCase.js';
import { SendStudentMessagesUseCase } from './application/commands/SendStudentMessagesUseCase.js';
import { SendChannelPostUseCase } from './application/commands/SendChannelPostUseCase.js';
import { GetBotInviteLinkUseCase } from './application/queries/GetBotInviteLinkUseCase.js';
import { DiscordSetupStatus } from './observability/DiscordSetupStatus.js';
import { ListTeacherDiscordChannelsUseCase } from './application/queries/ListTeacherDiscordChannelsUseCase.js';
import { ListTeacherDiscordServersUseCase } from './application/queries/ListTeacherDiscordServersUseCase.js';
import { TypeOrmDiscordServerOwnershipStore } from '../identity/infrastructure/persistence/typeorm/TypeOrmDiscordServerOwnershipStore.js';
import { DiscordClientFactory } from '../../infrastructure/external/discord/discord-api.service.js';
import { DiscordRecipientResolver } from '../../infrastructure/external/discord/discord-recipient-resolver.js';
import { DiscordServer } from '../../entities/discord-server.entity.js';
import { DiscordServerChannel } from '../../entities/discord-server-channel.entity.js';
import { DiscordServerOwnership } from '../../entities/discord-server-ownership.entity.js';
import { TypeOrmMessagingReader } from './infrastructure/persistence/typeorm/TypeOrmMessagingReader.js';
import { TypeOrmMessagingWriter } from './infrastructure/persistence/typeorm/TypeOrmMessagingWriter.js';
import { MessagingController } from './presentation/controllers/MessagingController.js';
import { createMessagingRouter } from './presentation/routes/messaging.routes.js';

const discordBotCredentialStore = createSysadminDiscordBotCredentialStore();
const discordServerOwnershipStore = new TypeOrmDiscordServerOwnershipStore();
const messagingReader = new TypeOrmMessagingReader();
const messagingWriter = new TypeOrmMessagingWriter();
const listTeacherDiscordServersUseCase = new ListTeacherDiscordServersUseCase(messagingReader);
const listTeacherDiscordChannelsUseCase = new ListTeacherDiscordChannelsUseCase(messagingReader);
const getBotInviteLinkUseCase = new GetBotInviteLinkUseCase(discordBotCredentialStore, messagingWriter);
const discordSetupStatus = new DiscordSetupStatus(
  messagingReader,
  discordBotCredentialStore,
  getBotInviteLinkUseCase,
);
const discordClientFactory = new DiscordClientFactory(discordBotCredentialStore);
const discordRecipientResolver = new DiscordRecipientResolver(
  async ({ botToken, ...input }) => (await discordClientFactory.getClient(botToken)).searchGuildMembers(input),
  discordBotCredentialStore,
);
const completeDiscordGuildInstallUseCase = new CompleteDiscordGuildInstallUseCase(
  discordServerOwnershipStore,
  discordBotCredentialStore,
);
const bindClassDiscordServerUseCase = new BindClassDiscordServerUseCase(messagingWriter);
const unbindClassDiscordServerUseCase = new UnbindClassDiscordServerUseCase(messagingWriter);
const sendStudentMessagesUseCase = new SendStudentMessagesUseCase(
  messagingWriter,
  discordClientFactory,
  discordRecipientResolver,
);
const sendChannelPostUseCase = new SendChannelPostUseCase(
  messagingWriter,
  discordClientFactory,
);
const messagingControllerDependencies = {
  listDiscordServers: (teacherId: number) => listTeacherDiscordServersUseCase.execute(teacherId),
  completeDiscordInstall: (input: { code?: string; state?: string; guild_id?: string; error?: string }) =>
    completeDiscordGuildInstallUseCase.execute(input),
  listDiscordChannels: async (teacherId: number, serverId: number) => {
    const server = await messagingWriter.findDiscordServerOwnershipById(teacherId, serverId);
    if (!server) {
      return [];
    }

    const discord = await discordClientFactory.getClient();
    const channels = await discord.listGuildChannels(server.discord_server_id);
    await messagingWriter.replaceDiscordServerChannels(
      server.discord_user_id,
      server.discord_server_id,
      channels.map((channel) => ({
        discord_channel_id: channel.id,
        name: channel.name,
        type: channel.type,
      })),
    );

    return listTeacherDiscordChannelsUseCase.execute(teacherId, server.discord_server_id);
  },
  getBotInviteLink: (teacherId: number) => getBotInviteLinkUseCase.execute(teacherId),
  getSetupStatus: (teacherId: number) => discordSetupStatus.execute(teacherId),
  upsertDiscordServerByClass: (
    teacherId: number,
    classId: number,
    input: Parameters<BindClassDiscordServerUseCase['execute']>[2],
  ) => bindClassDiscordServerUseCase.execute(teacherId, classId, input),
  unbindDiscordServerByClass: (teacherId: number, classId: number) =>
    unbindClassDiscordServerUseCase.execute(teacherId, classId),
  sendStudentMessages: (teacherId: number, input: Parameters<SendStudentMessagesUseCase['execute']>[1]) =>
    sendStudentMessagesUseCase.execute(teacherId, input),
  sendChannelPost: (teacherId: number, input: Parameters<SendChannelPostUseCase['execute']>[1]) =>
    sendChannelPostUseCase.execute(teacherId, input),
};

const messagingRouter = createMessagingRouter({
  listDiscordServers: new MessagingController('listDiscordServers', messagingControllerDependencies),
  listDiscordChannels: new MessagingController('listDiscordChannels', messagingControllerDependencies),
  completeDiscordInstall: new MessagingController('completeDiscordInstall', messagingControllerDependencies),
  getBotInviteLink: new MessagingController('getBotInviteLink', messagingControllerDependencies),
  getSetupStatus: new MessagingController('getSetupStatus', messagingControllerDependencies),
  upsertDiscordServer: new MessagingController('upsertDiscordServer', messagingControllerDependencies),
  unbindDiscordServer: new MessagingController('unbindDiscordServer', messagingControllerDependencies),
  sendStudentMessages: new MessagingController('sendStudentMessages', messagingControllerDependencies),
  sendChannelPost: new MessagingController('sendChannelPost', messagingControllerDependencies),
});

export const messagingModule: AppModule = {
  name: 'messaging',
  entities: [
    DiscordServer,
    DiscordServerOwnership,
    DiscordServerChannel,
  ],
  routes: [{ path: '/', router: messagingRouter }],
};
