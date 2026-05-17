import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';

import config from '../../config.js';
import { appEntities } from '../../modules/entities.js';

if (config.database.client !== 'mssql') {
  throw new Error(`Unsupported DB_CLIENT "${config.database.client}". This codebase is configured for Azure SQL Database with DB_CLIENT=mssql.`);
}

const databaseType = 'mssql';

const connectionOptions = {
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.name,
};

const driverOptions = {
  options: {
    encrypt: config.database.encrypt,
    trustServerCertificate: config.database.trustServerCertificate,
  },
};

const dataSourceOptions: DataSourceOptions = {
  type: databaseType,
  ...connectionOptions,
  ...driverOptions,
  entities: appEntities,
  dropSchema: false,
  synchronize: config.database.synchronize,
  logging: config.database.logging,
} as DataSourceOptions;

export const AppDataSource = new DataSource(dataSourceOptions);

async function dropUserTables(): Promise<void> {
  const resetDataSource = new DataSource({
    ...dataSourceOptions,
    entities: [],
    synchronize: false,
    dropSchema: false,
    logging: false,
  } as DataSourceOptions);

  await resetDataSource.initialize();

  try {
    const foreignKeys = await resetDataSource.query(`
      SELECT
        QUOTENAME(SCHEMA_NAME(parent.schema_id)) + '.' + QUOTENAME(parent.name) AS table_name,
        QUOTENAME(fk.name) AS constraint_name
      FROM sys.foreign_keys fk
      INNER JOIN sys.tables parent ON parent.object_id = fk.parent_object_id
      INNER JOIN sys.schemas schema_owner ON schema_owner.schema_id = parent.schema_id
      WHERE schema_owner.name NOT IN ('sys', 'INFORMATION_SCHEMA')
    `) as Array<{ table_name: string; constraint_name: string }>;

    for (const foreignKey of foreignKeys) {
      await resetDataSource.query(`ALTER TABLE ${foreignKey.table_name} DROP CONSTRAINT ${foreignKey.constraint_name}`);
    }

    const tables = await resetDataSource.query(`
      SELECT QUOTENAME(SCHEMA_NAME(schema_id)) + '.' + QUOTENAME(name) AS table_name
      FROM sys.tables
      WHERE is_ms_shipped = 0
        AND SCHEMA_NAME(schema_id) NOT IN ('sys', 'INFORMATION_SCHEMA')
      ORDER BY name
    `) as Array<{ table_name: string }>;

    for (const table of tables) {
      await resetDataSource.query(`DROP TABLE ${table.table_name}`);
    }
  } finally {
    await resetDataSource.destroy();
  }
}

export async function initializeDatabase(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    if (config.database.dropSchema) {
      await dropUserTables();
    }

    await AppDataSource.initialize();
  }

  return AppDataSource;
}
