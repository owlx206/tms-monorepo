import config from './config.js';
import { AppDataSource, initializeDatabase } from './infrastructure/database/data-source.js';
import { createJobRunner } from './infrastructure/jobs/index.js';
import { ensureSystemAdminAccount } from './modules/identity/infrastructure/bootstrap/ensureSystemAdminAccount.js';
import { createSysadminDiscordBotHealthJob } from './modules/identity/jobs/sysadmin-discord-bot-health.job.js';
import { createDiscordGuildSyncJob } from './modules/messaging/jobs/discord-guild-sync.job.js';
import { createSessionStatusSyncJob } from './modules/classroom/jobs/session-status-sync.job.js';
import { createVoiceAttendanceSyncJob } from './modules/classroom/jobs/voice-attendance-sync.job.js';
import { createCodeforcesTopicSyncJob } from './modules/topic/jobs/codeforces-topic-sync.job.js';

export async function main(): Promise<void> {
  await initializeDatabase();
  await ensureSystemAdminAccount();
  const { createApp } = await import('./app.js');

  const jobRunner = createJobRunner([
    createDiscordGuildSyncJob({
      enabled: config.autoSync.enabled && config.autoSync.syncDiscord,
      intervalSeconds: config.autoSync.intervalSeconds,
    }),
    createSysadminDiscordBotHealthJob({
      enabled: config.autoSync.enabled && config.autoSync.syncDiscord,
      intervalSeconds: config.autoSync.intervalSeconds,
    }),
    createCodeforcesTopicSyncJob({
      enabled: config.autoSync.enabled && config.autoSync.syncCodeforces,
      intervalSeconds: config.autoSync.intervalSeconds,
      standingIntervalSeconds: config.codeforcesStandingSync.intervalSeconds,
    }),
    createSessionStatusSyncJob({
      enabled: config.sessionStatusSync.enabled,
      intervalMs: config.sessionStatusSync.intervalSeconds * 1000,
    }),
    createVoiceAttendanceSyncJob({
      enabled: config.voiceAttendanceSync.enabled,
      intervalMs: config.voiceAttendanceSync.intervalSeconds * 1000,
    }),
  ]);

  jobRunner.startAll();

  const app = createApp();
  const server = config.host ? app.listen(config.port, config.host) : app.listen(config.port);

  server.on('listening', () => {
    console.log(`Backend server running at http://${config.host}:${config.port}`);
    console.log(
      `Database mode: synchronize=${String(config.database.synchronize)}, dropSchema=${String(config.database.dropSchema)}`,
    );
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error(`Failed to start backend server: ${error.message}`);
    process.exit(1);
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    console.log(`Received ${signal}, shutting down backend server`);
    await jobRunner.stopAll();

    server.close(async () => {
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }

      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
