import { SysadminDiscordBotCredential } from '../../../entities/sysadmin-discord-bot-credential.entity.js';
import { AppDataSource } from '../../../infrastructure/database/data-source.js';
import { checkDiscordBotTokenHealth } from '../../../infrastructure/external/discord/discord-api.service.js';
import type { IntervalJob } from '../../../jobs/index.js';

export async function checkSysadminDiscordBotHealthOnce(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    return;
  }

  const repo = AppDataSource.getRepository(SysadminDiscordBotCredential);
  const credential = await repo.findOneBy({ singleton_key: 'default' });
  if (!credential?.bot_token) {
    return;
  }

  const checkedAt = new Date();
  try {
    const health = await checkDiscordBotTokenHealth(credential.bot_token);
    credential.bot_health_status = health.healthy ? 'healthy' : 'unhealthy';
    credential.bot_health_message = health.message;
    credential.bot_health_checked_at = checkedAt;
  } catch (error) {
    credential.bot_health_status = 'unhealthy';
    credential.bot_health_message = error instanceof Error ? error.message : 'Failed to check bot token health.';
    credential.bot_health_checked_at = checkedAt;
  }

  await repo.save(credential);
}

export function createSysadminDiscordBotHealthJob(options: {
  enabled: boolean;
  intervalSeconds: number;
}): IntervalJob {
  return {
    name: 'sysadmin-discord-bot-health',
    enabled: options.enabled,
    intervalMs: Math.max(1, options.intervalSeconds) * 1000,
    run: checkSysadminDiscordBotHealthOnce,
  };
}
