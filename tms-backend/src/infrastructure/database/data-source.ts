import 'reflect-metadata';
import { DataSource } from 'typeorm';

import config from '../../config.js';
import { installDatabaseIntegrityRules } from './database-integrity.js';
import { appEntities } from '../../modules/entities.js';

const connectionOptions = {
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.name,
};

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...connectionOptions,
  entities: appEntities,
  dropSchema: config.database.dropSchema,
  synchronize: config.database.synchronize,
  logging: config.database.logging,
});

async function installPreSynchronizeSchemaPatches(): Promise<void> {
  const patchDataSource = new DataSource({
    type: 'postgres',
    ...connectionOptions,
  });

  await patchDataSource.initialize();

  try {
    await patchDataSource.query("ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'in_progress' AFTER 'scheduled'");
  } catch (error) {
    const driverError = error as { code?: string };
    if (driverError.code !== '42704') {
      throw error;
    }
  }

  try {
    await patchDataSource.query("ALTER TYPE attendance_source ADD VALUE IF NOT EXISTS 'system' AFTER 'bot'");
  } catch (error) {
    const driverError = error as { code?: string };
    if (driverError.code !== '42704') {
      throw error;
    }
  } finally {
    await patchDataSource.destroy();
  }
}

export async function initializeDatabase(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await installPreSynchronizeSchemaPatches();

    await AppDataSource.initialize();
    await installDatabaseIntegrityRules(AppDataSource);
  }

  return AppDataSource;
}
