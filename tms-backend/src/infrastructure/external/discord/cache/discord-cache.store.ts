import { type EntityManager } from 'typeorm';

import { AppDataSource } from '../../../database/data-source.js';
import { DiscordGuildChannelCache } from './entities/discord-guild-channel-cache.entity.js';
import { DiscordUserGuild } from './entities/discord-user-guild.entity.js';

export class TypeOrmDiscordCacheStore {
  constructor(private readonly manager: EntityManager = AppDataSource.manager) {}

  findAnyGuildByDiscordGuildId(discordGuildId: string): Promise<DiscordUserGuild | null> {
    return this.manager.getRepository(DiscordUserGuild).findOneBy({
      discord_guild_id: discordGuildId,
    });
  }

  findGuildByOwnerAndDiscordGuildId(
    discordUserId: string,
    discordGuildId: string,
  ): Promise<DiscordUserGuild | null> {
    return this.manager.getRepository(DiscordUserGuild).findOneBy({
      discord_user_id: discordUserId,
      discord_guild_id: discordGuildId,
    });
  }

  findGuildByOwnerAndId(discordUserId: string, id: number): Promise<DiscordUserGuild | null> {
    return this.manager.getRepository(DiscordUserGuild).findOneBy({
      discord_user_id: discordUserId,
      id,
    });
  }

  listGuildsForOwner(discordUserId: string): Promise<DiscordUserGuild[]> {
    return this.manager.getRepository(DiscordUserGuild).find({
      where: { discord_user_id: discordUserId },
      order: { name: 'ASC' },
    });
  }

  async listGuildIdsForOwner(discordUserId: string): Promise<string[]> {
    const guilds = await this.manager.getRepository(DiscordUserGuild).find({
      where: { discord_user_id: discordUserId },
      select: { discord_guild_id: true },
    });

    return guilds.map((guild) => guild.discord_guild_id);
  }

  createGuild(values: Partial<DiscordUserGuild>): DiscordUserGuild {
    return this.manager.getRepository(DiscordUserGuild).create(values);
  }

  saveGuild(userGuild: DiscordUserGuild): Promise<DiscordUserGuild> {
    return this.manager.getRepository(DiscordUserGuild).save(userGuild);
  }

  async replaceGuilds(
    discordUserId: string,
    guilds: Array<{ discord_guild_id: string; name: string }>,
  ): Promise<DiscordUserGuild[]> {
    const repo = this.manager.getRepository(DiscordUserGuild);
    const existingGuilds = await repo.find({ where: { discord_user_id: discordUserId } });
    const existingByDiscordGuildId = new Map(
      existingGuilds.map((guild) => [guild.discord_guild_id, guild]),
    );
    const nextDiscordGuildIds = guilds.map((guild) => guild.discord_guild_id);

    const deleteQuery = repo
      .createQueryBuilder()
      .delete()
      .from(DiscordUserGuild)
      .where('discord_user_id = :discordUserId', { discordUserId });

    if (nextDiscordGuildIds.length > 0) {
      deleteQuery.andWhere('discord_guild_id NOT IN (:...discordGuildIds)', {
        discordGuildIds: nextDiscordGuildIds,
      });
    }

    await deleteQuery.execute();
    if (guilds.length === 0) {
      return [];
    }

    return repo.save(guilds.map((guild) => {
      const existing = existingByDiscordGuildId.get(guild.discord_guild_id);
      const entity = existing ?? repo.create({
        discord_user_id: discordUserId,
        discord_guild_id: guild.discord_guild_id,
      });
      entity.name = guild.name;
      entity.synced_at = new Date();
      return entity;
    }));
  }

  findChannelByOwnerAndId(discordUserId: string, id: number): Promise<DiscordGuildChannelCache | null> {
    return this.manager.getRepository(DiscordGuildChannelCache).findOneBy({
      discord_user_id: discordUserId,
      id,
    });
  }

  findChannelByOwnerAndDiscordChannelId(
    discordUserId: string,
    discordChannelId: string,
  ): Promise<DiscordGuildChannelCache | null> {
    return this.manager.getRepository(DiscordGuildChannelCache).findOneBy({
      discord_user_id: discordUserId,
      discord_channel_id: discordChannelId,
    });
  }

  listChannelsForOwnerAndGuild(discordUserId: string, discordGuildId: string): Promise<DiscordGuildChannelCache[]> {
    return this.manager.getRepository(DiscordGuildChannelCache).find({
      where: {
        discord_user_id: discordUserId,
        discord_guild_id: discordGuildId,
      },
      order: {
        type: 'ASC',
        name: 'ASC',
      },
    });
  }

  async replaceChannels(
    discordUserId: string,
    discordGuildId: string,
    channels: Array<{ discord_channel_id: string; name: string; type: 'text' | 'voice' }>,
  ): Promise<DiscordGuildChannelCache[]> {
    const repo = this.manager.getRepository(DiscordGuildChannelCache);
    const existingChannels = await repo.find({
      where: {
        discord_user_id: discordUserId,
        discord_guild_id: discordGuildId,
      },
    });
    const existingByDiscordChannelId = new Map(
      existingChannels.map((channel) => [channel.discord_channel_id, channel]),
    );
    const nextDiscordChannelIds = channels.map((channel) => channel.discord_channel_id);

    const deleteQuery = repo
      .createQueryBuilder()
      .delete()
      .from(DiscordGuildChannelCache)
      .where('discord_user_id = :discordUserId', { discordUserId })
      .andWhere('discord_guild_id = :discordGuildId', { discordGuildId });

    if (nextDiscordChannelIds.length > 0) {
      deleteQuery.andWhere('discord_channel_id NOT IN (:...discordChannelIds)', {
        discordChannelIds: nextDiscordChannelIds,
      });
    }

    await deleteQuery.execute();

    if (channels.length === 0) {
      return [];
    }

    return repo.save(channels.map((channel) => {
      const existing = existingByDiscordChannelId.get(channel.discord_channel_id);
      const entity = existing ?? repo.create({
        discord_user_id: discordUserId,
        discord_guild_id: discordGuildId,
        discord_channel_id: channel.discord_channel_id,
      });
      entity.name = channel.name;
      entity.type = channel.type;
      entity.synced_at = new Date();
      return entity;
    }));
  }

  async deleteChannelsForOwnerExceptGuilds(discordUserId: string, discordGuildIds: string[]): Promise<number> {
    const query = this.manager.getRepository(DiscordGuildChannelCache)
      .createQueryBuilder()
      .delete()
      .from(DiscordGuildChannelCache)
      .where('discord_user_id = :discordUserId', { discordUserId });

    if (discordGuildIds.length > 0) {
      query.andWhere('discord_guild_id NOT IN (:...discordGuildIds)', { discordGuildIds });
    }

    const result = await query.execute();
    return result.affected ?? 0;
  }
}
