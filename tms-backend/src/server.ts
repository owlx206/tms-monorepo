import config from './config.js';
import { AppDataSource, initializeDatabase } from './infrastructure/database/data-source.js';
import { ensureSystemAdminAccount } from './modules/identity/infrastructure/bootstrap/ensureSystemAdminAccount.js';
import { startCodeforcesSyncWorker } from './modules/classroom/infrastructure/sync/codeforces-gym-sync.worker.js';
import { startClassroomDiscordSyncWorker } from './modules/classroom/infrastructure/sync/discord-classroom-sync.worker.js';

export async function main(): Promise<void> {
  await initializeDatabase();
  await ensureSystemAdminAccount();
  const { createApp } = await import('./app.js');
  const syncLoops = [startClassroomDiscordSyncWorker(), startCodeforcesSyncWorker()];

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
    await Promise.all(syncLoops.map((loop) => loop.stop()));

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
