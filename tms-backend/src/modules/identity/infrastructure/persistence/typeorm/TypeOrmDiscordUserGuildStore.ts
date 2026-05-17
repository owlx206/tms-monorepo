import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { DiscordGuildChannelCache } from '../../../../../entities/discord-channel.entity.js';
import { DiscordUserGuild } from '../../../../../entities/discord-guild.entity.js';

export class TypeOrmDiscordUserGuildStore {
  findAnyByDiscordGuildId(discordGuildId: string): Promise<DiscordUserGuild | null> {
    return AppDataSource.getRepository(DiscordUserGuild).findOneBy({
      discord_guild_id: discordGuildId,
    });
  }

  findByOwnerAndDiscordGuildId(
    discordUserId: string,
    discordGuildId: string,
  ): Promise<DiscordUserGuild | null> {
    return AppDataSource.getRepository(DiscordUserGuild).findOneBy({
      discord_user_id: discordUserId,
      discord_guild_id: discordGuildId,
    });
  }

  createUserGuild(values: Partial<DiscordUserGuild>): DiscordUserGuild {
    return AppDataSource.getRepository(DiscordUserGuild).create(values);
  }

  saveUserGuild(userGuild: DiscordUserGuild): Promise<DiscordUserGuild> {
    return AppDataSource.getRepository(DiscordUserGuild).save(userGuild);
  }

  async replaceChannelCache(
    discordUserId: string,
    discordGuildId: string,
    channels: Array<{ discord_channel_id: string; name: string; type: 'text' | 'voice' }>,
  ): Promise<DiscordGuildChannelCache[]> {
    const repo = AppDataSource.getRepository(DiscordGuildChannelCache);
    await repo.delete({
      discord_user_id: discordUserId,
      discord_guild_id: discordGuildId,
    });

    if (channels.length === 0) {
      return [];
    }

    return repo.save(channels.map((channel) => repo.create({
      discord_user_id: discordUserId,
      discord_guild_id: discordGuildId,
      discord_channel_id: channel.discord_channel_id,
      name: channel.name,
      type: channel.type,
      synced_at: new Date(),
    })));
  }
}
