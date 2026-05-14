import { AppDataSource } from '../../../infrastructure/database/data-source.js';
import { DiscordServer } from '../../../entities/index.js';
import { DiscordClient } from '../../../infrastructure/external/discord/discord-api.service.js';
import type { IntervalJob } from '../../../jobs/index.js';

async function fetchDiscordServerName(discordServerId: string, botToken: string): Promise<string | null> {
  try {
    const guild = await new DiscordClient(botToken).fetchGuildMetadata(discordServerId);
    return guild.name;
  } catch {
    return null;
  }
}

export async function syncDiscordServersOnce(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    return;
  }

  const repo = AppDataSource.getRepository(DiscordServer);
  const servers = await repo.find();
  const dirty: DiscordServer[] = [];

  for (const server of servers) {
    if (!server.bot_token) {
      continue;
    }

    const syncedName = await fetchDiscordServerName(server.discord_server_id, server.bot_token);
    if (!syncedName || syncedName === server.name) {
      continue;
    }

    server.name = syncedName;
    dirty.push(server);
  }

  if (dirty.length > 0) {
    await repo.save(dirty);
    console.log(`[discord-server-sync] servers updated: ${dirty.length}`);
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
