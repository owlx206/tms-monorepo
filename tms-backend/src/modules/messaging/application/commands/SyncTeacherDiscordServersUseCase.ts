import type { StoredDiscordGateway } from '../../infrastructure/discord/StoredDiscordGateway.js';
import type { TypeOrmMessagingWriter } from '../../infrastructure/persistence/typeorm/TypeOrmMessagingWriter.js';
import type { SysadminDiscordBotCredentialStore } from '../../../identity/index.js';

export class SyncTeacherDiscordServersUseCase {
  constructor(
    private readonly messagingWriter: TypeOrmMessagingWriter,
    private readonly discordGateway: StoredDiscordGateway,
    private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore,
  ) {}

  async execute(teacherId: number) {
    const credential = await this.discordBotCredentialStore.findDefault();
    const botToken = credential?.bot_token ?? null;
    const guilds = await this.discordGateway.listGuilds(botToken);
    const syncedDiscordServerIds = guilds.map((guild) => guild.id);

    const cachedGuilds = await this.messagingWriter.replaceTeacherDiscordServerCaches(
      teacherId,
      guilds.map((guild) => ({
        discord_server_id: guild.id,
        name: guild.name,
      })),
    );

    for (const guild of cachedGuilds) {
      const channels = await this.discordGateway.listGuildChannels(guild.discord_server_id, botToken);
      await this.messagingWriter.replaceTeacherDiscordChannelCaches(
        teacherId,
        guild.discord_server_id,
        channels.map((channel) => ({
          discord_channel_id: channel.id,
          name: channel.name,
        type: channel.type,
        })),
      );
    }

    const pruned = await this.messagingWriter.pruneDiscordDataForMissingServers(
      teacherId,
      syncedDiscordServerIds,
    );

    return {
      synced_servers: cachedGuilds.length,
      removed_server_bindings: pruned.removed_server_bindings,
      removed_channel_caches: pruned.removed_channel_caches,
    };
  }
}
