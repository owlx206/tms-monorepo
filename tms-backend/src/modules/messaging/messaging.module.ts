import type { AppModule } from '../module.types.js';
import { createSysadminDiscordBotCredentialStore } from '../identity/index.js';
import { BindClassDiscordGuildUseCase } from './application/commands/BindClassDiscordGuildUseCase.js';
import { UnbindClassDiscordGuildUseCase } from './application/commands/UnbindClassDiscordGuildUseCase.js';
import { CompleteDiscordGuildInstallUseCase } from '../identity/application/commands/CompleteDiscordGuildInstallUseCase.js';
import { SendStudentMessagesUseCase } from './application/commands/SendStudentMessagesUseCase.js';
import { SendChannelPostUseCase } from './application/commands/SendChannelPostUseCase.js';
import { GetBotInviteLinkUseCase } from './application/queries/GetBotInviteLinkUseCase.js';
import { DiscordSetupStatus } from './observability/DiscordSetupStatus.js';
import { ListTeacherDiscordChannelsUseCase } from './application/queries/ListTeacherDiscordChannelsUseCase.js';
import { ListTeacherDiscordGuildsUseCase } from './application/queries/ListTeacherDiscordGuildsUseCase.js';
import { TypeOrmDiscordUserGuildStore } from '../identity/infrastructure/persistence/typeorm/TypeOrmDiscordUserGuildStore.js';
import { DiscordClientFactory } from '../../infrastructure/external/discord/discord-api.service.js';
import { DiscordRecipientResolver } from '../../infrastructure/external/discord/discord-recipient-resolver.js';
import { ClassDiscordBinding } from '../../entities/class-guild.entity.js';
import { DiscordGuildChannelCache } from '../../entities/discord-channel.entity.js';
import { DiscordUserGuild } from '../../entities/discord-guild.entity.js';
import { TypeOrmMessagingReader } from './infrastructure/persistence/typeorm/TypeOrmMessagingReader.js';
import { TypeOrmMessagingWriter } from './infrastructure/persistence/typeorm/TypeOrmMessagingWriter.js';
import { MessagingController } from './presentation/controllers/MessagingController.js';
import { createMessagingRouter } from './presentation/routes/messaging.routes.js';

const discordBotCredentialStore = createSysadminDiscordBotCredentialStore();
const discordUserGuildStore = new TypeOrmDiscordUserGuildStore();
const messagingReader = new TypeOrmMessagingReader();
const messagingWriter = new TypeOrmMessagingWriter();
const listTeacherDiscordGuildsUseCase = new ListTeacherDiscordGuildsUseCase(messagingReader);
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
  discordUserGuildStore,
  discordBotCredentialStore,
);
const bindClassDiscordGuildUseCase = new BindClassDiscordGuildUseCase(messagingWriter);
const unbindClassDiscordGuildUseCase = new UnbindClassDiscordGuildUseCase(messagingWriter);
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
  listDiscordGuilds: (teacherId: number) => listTeacherDiscordGuildsUseCase.execute(teacherId),
  completeDiscordInstall: (input: { code?: string; state?: string; guild_id?: string; error?: string }) =>
    completeDiscordGuildInstallUseCase.execute(input),
  listDiscordGuildChannels: async (teacherId: number, guildId: number) => {
    const guild = await messagingWriter.findDiscordUserGuildById(teacherId, guildId);
    if (!guild) {
      return [];
    }

    const discord = await discordClientFactory.getClient();
    const channels = await discord.listGuildChannels(guild.discord_guild_id);
    await messagingWriter.replaceDiscordGuildChannelCaches(
      guild.discord_user_id,
      guild.discord_guild_id,
      channels.map((channel) => ({
        discord_channel_id: channel.id,
        name: channel.name,
        type: channel.type,
      })),
    );

    return listTeacherDiscordChannelsUseCase.execute(teacherId, guild.discord_guild_id);
  },
  getBotInviteLink: (teacherId: number) => getBotInviteLinkUseCase.execute(teacherId),
  getSetupStatus: (teacherId: number) => discordSetupStatus.execute(teacherId),
  upsertDiscordGuildByClass: (
    teacherId: number,
    classId: number,
    input: Parameters<BindClassDiscordGuildUseCase['execute']>[2],
  ) => bindClassDiscordGuildUseCase.execute(teacherId, classId, input),
  unbindDiscordGuildByClass: (teacherId: number, classId: number) =>
    unbindClassDiscordGuildUseCase.execute(teacherId, classId),
  sendStudentMessages: (teacherId: number, input: Parameters<SendStudentMessagesUseCase['execute']>[1]) =>
    sendStudentMessagesUseCase.execute(teacherId, input),
  sendChannelPost: (teacherId: number, input: Parameters<SendChannelPostUseCase['execute']>[1]) =>
    sendChannelPostUseCase.execute(teacherId, input),
};

const messagingRouter = createMessagingRouter({
  listDiscordGuilds: new MessagingController('listDiscordGuilds', messagingControllerDependencies),
  listDiscordGuildChannels: new MessagingController('listDiscordGuildChannels', messagingControllerDependencies),
  completeDiscordInstall: new MessagingController('completeDiscordInstall', messagingControllerDependencies),
  getBotInviteLink: new MessagingController('getBotInviteLink', messagingControllerDependencies),
  getSetupStatus: new MessagingController('getSetupStatus', messagingControllerDependencies),
  upsertClassDiscordBinding: new MessagingController('upsertClassDiscordBinding', messagingControllerDependencies),
  unbindClassDiscordBinding: new MessagingController('unbindClassDiscordBinding', messagingControllerDependencies),
  sendStudentMessages: new MessagingController('sendStudentMessages', messagingControllerDependencies),
  sendChannelPost: new MessagingController('sendChannelPost', messagingControllerDependencies),
});

export const messagingModule: AppModule = {
  name: 'messaging',
  entities: [
    ClassDiscordBinding,
    DiscordUserGuild,
    DiscordGuildChannelCache,
  ],
  routes: [{ path: '/', router: messagingRouter }],
};
