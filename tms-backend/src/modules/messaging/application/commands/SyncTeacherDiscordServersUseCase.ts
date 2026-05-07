import type { DiscordGatewayFactory } from '../ports/DiscordGateway.js';
import type { MessagingWriteRepository } from '../../infrastructure/persistence/typeorm/MessagingWriteRepository.js';
import type { SysadminDiscordBotCredentialStore } from '../../../identity/infrastructure/persistence/typeorm/SysadminDiscordBotCredentialStore.js';

export class SyncTeacherDiscordServersUseCase {
  constructor(
    private readonly messagingWriteRepository: MessagingWriteRepository,
    private readonly discordGatewayFactory: DiscordGatewayFactory,
    private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore,
  ) {}

  async execute(teacherId: number) {
    const credential = await this.discordBotCredentialStore.findDefault();
    const discord = this.discordGatewayFactory.create(credential?.bot_token ?? null);
    const guilds = await discord.listGuilds();

    const cachedGuilds = await this.messagingWriteRepository.replaceTeacherDiscordServerCaches(
      teacherId,
      guilds.map((guild) => ({
        discord_server_id: guild.id,
        name: guild.name,
      })),
    );

    for (const guild of cachedGuilds) {
      const channels = await discord.listGuildChannels(guild.discord_server_id);
      await this.messagingWriteRepository.replaceTeacherDiscordChannelCaches(
        teacherId,
        guild.discord_server_id,
        channels.map((channel) => ({
          discord_channel_id: channel.id,
          name: channel.name,
          type: channel.type,
        })),
      );
    }

    return {
      synced_servers: cachedGuilds.length,
    };
  }
}
