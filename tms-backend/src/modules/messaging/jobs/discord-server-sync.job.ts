import { AppDataSource } from '../../../infrastructure/database/data-source.js';
import {
  DiscordServer,
  DiscordServerChannel,
  DiscordServerOwnership,
  SysadminDiscordBotCredential,
  Teacher,
} from '../../../entities/index.js';
import { DiscordClient } from '../../../infrastructure/external/discord/discord-api.service.js';
import type { IntervalJob } from '../../../jobs/index.js';

export async function syncDiscordServersOnce(): Promise<void> {
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
    .andWhere("LENGTH(TRIM(teacher.discord_user_id)) > 0")
    .getMany();
  let syncedServers = 0;
  let removedBindings = 0;

  for (const teacher of teachers) {
    const discordUserId = teacher.discord_user_id;
    if (!discordUserId) {
      continue;
    }

    const [ownedServers, boundServers] = await Promise.all([
      AppDataSource.getRepository(DiscordServerOwnership).find({
        where: { discord_user_id: discordUserId },
        select: { discord_server_id: true },
      }),
      AppDataSource.getRepository(DiscordServer).find({
        where: { teacher_id: teacher.id },
        select: { discord_server_id: true },
      }),
    ]);
    const knownDiscordServerIds = Array.from(new Set(
      [...ownedServers, ...boundServers]
        .map((server) => server.discord_server_id.trim())
        .filter((discordServerId) => discordServerId.length > 0),
    ));
    const guilds: Array<{ id: string; name: string }> = [];

    for (const discordServerId of knownDiscordServerIds) {
      try {
        guilds.push(await discord.fetchGuildMetadata(discordServerId));
      } catch {
        // Missing/inaccessible guilds are pruned after successful fetches are known.
      }
    }

    await AppDataSource.transaction(async (manager) => {
      const ownershipRepo = manager.getRepository(DiscordServerOwnership);
      const channelRepo = manager.getRepository(DiscordServerChannel);
      const bindingRepo = manager.getRepository(DiscordServer);
      await ownershipRepo.delete({ discord_user_id: discordUserId });

      if (guilds.length > 0) {
        await ownershipRepo.save(guilds.map((guild) => ownershipRepo.create({
          discord_user_id: discordUserId,
          discord_server_id: guild.id,
          name: guild.name,
          synced_at: new Date(),
        })));
      }

      const syncedDiscordServerIds = guilds.map((guild) => guild.id);
      const bindingDeleteQuery = bindingRepo
        .createQueryBuilder()
        .delete()
        .from(DiscordServer)
        .where('teacher_id = :teacherId', { teacherId: teacher.id });
      const channelDeleteQuery = channelRepo
        .createQueryBuilder()
        .delete()
        .from(DiscordServerChannel)
        .where('discord_user_id = :discordUserId', { discordUserId });

      if (syncedDiscordServerIds.length > 0) {
        bindingDeleteQuery.andWhere('discord_server_id NOT IN (:...discordServerIds)', {
          discordServerIds: syncedDiscordServerIds,
        });
        channelDeleteQuery.andWhere('discord_server_id NOT IN (:...discordServerIds)', {
          discordServerIds: syncedDiscordServerIds,
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
        const channelRepo = AppDataSource.getRepository(DiscordServerChannel);
        await channelRepo.delete({
          discord_user_id: discordUserId,
          discord_server_id: guild.id,
        });
        if (channels.length > 0) {
          await channelRepo.save(channels.map((channel) => channelRepo.create({
            discord_user_id: discordUserId,
            discord_server_id: guild.id,
            discord_channel_id: channel.id,
            name: channel.name,
            type: channel.type,
            synced_at: new Date(),
          })));
        }
      } catch {
        // Server ownership remains; channel list will be retried by the next job run.
      }
    }

    syncedServers += guilds.length;
  }

  if (teachers.length > 0) {
    console.log(`[discord-server-sync] teachers=${teachers.length}, servers=${syncedServers}, removed_bindings=${removedBindings}`);
  }
}

export function createDiscordServerSyncJob(options: {
  enabled: boolean;
  intervalSeconds: number;
}): IntervalJob {
  return {
    name: 'discord-server-sync',
    enabled: options.enabled,
    intervalMs: Math.max(1, options.intervalSeconds) * 1000,
    run: syncDiscordServersOnce,
  };
}
