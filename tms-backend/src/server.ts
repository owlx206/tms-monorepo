import config from './config.js';
import { AppDataSource, initializeDatabase } from './infrastructure/database/data-source.js';
import { createApp } from './app.js';
import { createJobRunner } from './jobs/index.js';
import { createSysadminDiscordBotHealthJob, ensureSystemAdminAccount } from './modules/identity/index.js';
import { createDiscordServerSyncJob } from './modules/messaging/index.js';
import { createSessionStatusSyncJob, createVoiceAttendanceSyncJob } from './modules/classroom/index.js';
import { createCodeforcesTopicSyncJob } from './modules/topic/index.js';

export async function main(): Promise<void> {
  await initializeDatabase();
  await ensureSystemAdminAccount();

  const jobRunner = createJobRunner([
    createDiscordServerSyncJob({
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

main().catch((error: unknown) => {
  console.error('Failed to initialize backend server');
  console.error(error);
  process.exit(1);
});
