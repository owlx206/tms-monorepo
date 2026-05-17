import { AppDataSource } from '../../../infrastructure/database/data-source.js';
import {
  ClassDiscordBinding,
  DiscordGuildChannelCache,
  DiscordUserGuild,
  SysadminDiscordBotCredential,
  Teacher,
} from '../../../entities/index.js';
import { DiscordClient } from '../../../infrastructure/external/discord/discord-api.service.js';
import type { IntervalJob } from '../../../jobs/index.js';

export async function syncDiscordGuildsOnce(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    return;
  }

  const credential = await AppDataSource.getRepository(SysadminDiscordBotCredential).findOneBy({
    singleton_key: 'default',
  });
  const botToken = credential?.bot_token?.trim();
  if (!botToken) {
    return;
  }

  const discord = new DiscordClient(botToken);
  const teachers = await AppDataSource.getRepository(Teacher)
    .createQueryBuilder('teacher')
    .where('teacher.discord_user_id IS NOT NULL')
    .andWhere("LEN(TRIM(teacher.discord_user_id)) > 0")
    .getMany();
  let syncedGuilds = 0;
  let removedBindings = 0;

  for (const teacher of teachers) {
    const discordUserId = teacher.discord_user_id;
    if (!discordUserId) {
      continue;
    }

    const [ownedGuilds, boundGuilds] = await Promise.all([
      AppDataSource.getRepository(DiscordUserGuild).find({
        where: { discord_user_id: discordUserId },
        select: { discord_guild_id: true },
      }),
      AppDataSource.getRepository(ClassDiscordBinding).find({
        where: { teacher_id: teacher.id },
        select: { discord_guild_id: true },
      }),
    ]);
    const knownDiscordGuildIds = Array.from(new Set(
      [...ownedGuilds, ...boundGuilds]
        .map((guild) => guild.discord_guild_id.trim())
        .filter((discordGuildId) => discordGuildId.length > 0),
    ));
    const guilds: Array<{ id: string; name: string }> = [];

    for (const discordGuildId of knownDiscordGuildIds) {
      try {
        guilds.push(await discord.fetchGuildMetadata(discordGuildId));
      } catch {
        // Missing/inaccessible guilds are pruned after successful fetches are known.
      }
    }

    await AppDataSource.transaction(async (manager) => {
      const ownershipRepo = manager.getRepository(DiscordUserGuild);
      const channelRepo = manager.getRepository(DiscordGuildChannelCache);
      const bindingRepo = manager.getRepository(ClassDiscordBinding);
      await ownershipRepo.delete({ discord_user_id: discordUserId });

      if (guilds.length > 0) {
        await ownershipRepo.save(guilds.map((guild) => ownershipRepo.create({
          discord_user_id: discordUserId,
          discord_guild_id: guild.id,
          name: guild.name,
          synced_at: new Date(),
        })));
      }

      const syncedDiscordGuildIds = guilds.map((guild) => guild.id);
      const bindingDeleteQuery = bindingRepo
        .createQueryBuilder()
        .delete()
        .from(ClassDiscordBinding)
        .where('teacher_id = :teacherId', { teacherId: teacher.id });
      const channelDeleteQuery = channelRepo
        .createQueryBuilder()
        .delete()
        .from(DiscordGuildChannelCache)
        .where('discord_user_id = :discordUserId', { discordUserId });

      if (syncedDiscordGuildIds.length > 0) {
        bindingDeleteQuery.andWhere('discord_guild_id NOT IN (:...discordGuildIds)', {
          discordGuildIds: syncedDiscordGuildIds,
        });
        channelDeleteQuery.andWhere('discord_guild_id NOT IN (:...discordGuildIds)', {
          discordGuildIds: syncedDiscordGuildIds,
        });
      }

      const [bindingDelete] = await Promise.all([
        bindingDeleteQuery.execute(),
        channelDeleteQuery.execute(),
      ]);
      removedBindings += bindingDelete.affected ?? 0;
    });

    for (const guild of guilds) {
      try {
        const channels = await discord.listGuildChannels(guild.id);
        const channelRepo = AppDataSource.getRepository(DiscordGuildChannelCache);
        await channelRepo.delete({
          discord_user_id: discordUserId,
          discord_guild_id: guild.id,
        });
        if (channels.length > 0) {
          await channelRepo.save(channels.map((channel) => channelRepo.create({
            discord_user_id: discordUserId,
            discord_guild_id: guild.id,
            discord_channel_id: channel.id,
            name: channel.name,
            type: channel.type,
            synced_at: new Date(),
          })));
        }
      } catch {
        // User guild remains; channel list will be retried by the next job run.
      }
    }

    syncedGuilds += guilds.length;
  }

  if (teachers.length > 0) {
    console.log(`[discord-guild-sync] teachers=${teachers.length}, guilds=${syncedGuilds}, removed_bindings=${removedBindings}`);
  }
}

export function createDiscordGuildSyncJob(options: {
  enabled: boolean;
  intervalSeconds: number;
}): IntervalJob {
  return {
    name: 'discord-guild-sync',
    enabled: options.enabled,
    intervalMs: Math.max(1, options.intervalSeconds) * 1000,
    run: syncDiscordGuildsOnce,
  };
}
