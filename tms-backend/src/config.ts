function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === 'true';
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

type DatabaseConfig = {
  host?: string;
  port: number;
  username?: string;
  password?: string;
  name?: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
};

function getPublicUrl(primaryKey: string, legacyKey?: string): string {
  const value = parseOptionalString(process.env[primaryKey])
    ?? (legacyKey ? parseOptionalString(process.env[legacyKey]) : undefined)
    ?? `http://localhost:${backendPort}`;

  return normalizeBaseUrl(value);
}

const backendPort = parsePositiveInteger(
  process.env.PORT ?? process.env.WEBSITES_PORT,
  4000,
);

function parseConnectionStringOptions(value: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const part of value.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    result[trimmed.slice(0, separatorIndex).trim().toLowerCase()] = trimmed
      .slice(separatorIndex + 1)
      .trim();
  }

  return result;
}

function parseSqlServerUrl(value: string): Partial<DatabaseConfig> {
  try {
    const url = new URL(value);
    const databaseName = parseOptionalString(url.searchParams.get('database') ?? undefined)
      ?? parseOptionalString(url.searchParams.get('initial catalog') ?? undefined);

    return {
      host: parseOptionalString(url.hostname),
      port: parsePositiveInteger(url.port, 1433),
      username: parseOptionalString(decodeURIComponent(url.username)),
      password: parseOptionalString(decodeURIComponent(url.password)),
      name: databaseName,
      encrypt: parseBoolean(url.searchParams.get('encrypt') ?? undefined, true),
      trustServerCertificate: parseBoolean(
        url.searchParams.get('trustServerCertificate') ?? undefined,
        false,
      ),
    };
  } catch {
    return {};
  }
}

function parseAdoConnectionString(value: string): Partial<DatabaseConfig> {
  const options = parseConnectionStringOptions(value);
  const rawServer = options.server ?? options['data source'] ?? options.address;
  const server = rawServer?.replace(/^tcp:/i, '');
  const [host, port] = server?.split(',') ?? [];

  return {
    host: parseOptionalString(host),
    port: parsePositiveInteger(port, 1433),
    username: parseOptionalString(options['user id'] ?? options.uid ?? options.user),
    password: parseOptionalString(options.password ?? options.pwd),
    name: parseOptionalString(options.database ?? options['initial catalog']),
    encrypt: parseBoolean(options.encrypt, true),
    trustServerCertificate: parseBoolean(options.trustservercertificate, false),
  };
}

function getAzureSqlConnectionString(): string | undefined {
  for (const [key, value] of Object.entries(process.env)) {
    if ((key.startsWith('SQLCONNSTR_') || key.startsWith('SQLAZURECONNSTR_')) && value) {
      return value;
    }
  }

  return undefined;
}

function getDatabaseConfig(): DatabaseConfig {
  const connectionString = parseOptionalString(process.env.DATABASE_URL)
    ?? getAzureSqlConnectionString();
  const parsedConnectionString = connectionString
    ? connectionString.includes('://')
      ? parseSqlServerUrl(connectionString)
      : parseAdoConnectionString(connectionString)
    : {};

  const databaseConfig: DatabaseConfig = {
    host: parseOptionalString(process.env.DB_HOST) ?? parsedConnectionString.host,
    port: parsePositiveInteger(process.env.DB_PORT, parsedConnectionString.port ?? 1433),
    username: parseOptionalString(process.env.DB_USER) ?? parsedConnectionString.username,
    password: parseOptionalString(process.env.DB_PASSWORD) ?? parsedConnectionString.password,
    name: parseOptionalString(process.env.DB_NAME) ?? parsedConnectionString.name,
    encrypt: parseBoolean(process.env.DB_ENCRYPT, parsedConnectionString.encrypt ?? true),
    trustServerCertificate: parseBoolean(
      process.env.DB_TRUST_SERVER_CERTIFICATE,
      parsedConnectionString.trustServerCertificate ?? false,
    ),
  };

  const missingKeys = [
    ['DB_HOST', databaseConfig.host],
    ['DB_USER', databaseConfig.username],
    ['DB_PASSWORD', databaseConfig.password],
    ['DB_NAME', databaseConfig.name],
  ]
    .filter(([, value]) => value === undefined)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required database configuration: ${missingKeys.join(', ')}. Set DB_* variables, DATABASE_URL, or an Azure SQL connection string.`,
    );
  }

  return databaseConfig;
}

const databaseConfig = getDatabaseConfig();

const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  host: parseOptionalString(process.env.HOST) ?? '0.0.0.0',
  port: backendPort,
  apiPrefix: parseOptionalString(process.env.API_PREFIX) ?? '/api',
  frontendUrl: getPublicUrl('FRONTEND_URL', 'FRONTEND_PUBLIC_URL'),
  backendPublicUrl: getPublicUrl('BACKEND_URL', 'BACKEND_PUBLIC_URL'),
  discordFallbackURL: normalizeBaseUrl(
    parseOptionalString(process.env.DISCORD_FALLBACK_URL) ?? 'https://saas.owlab.uk',
  ),
  frontendDistDir: parseOptionalString(process.env.FRONTEND_DIST_DIR),
  auth: {
    jwtSecret: process.env.JWT_SECRET as string,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN,
    jwtIssuer: process.env.JWT_ISSUER,
    jwtAudience: process.env.JWT_AUDIENCE,
    bcryptSaltRounds: parsePositiveInteger(process.env.BCRYPT_SALT_ROUNDS, 12),
    allowPublicRegistration: parseBoolean(process.env.AUTH_ALLOW_PUBLIC_REGISTRATION, false),
    sysAdminUsername: process.env.SYSADMIN_USERNAME ?? 'admin',
    sysAdminPassword: parseOptionalString(process.env.SYSADMIN_PASSWORD),
  },
  discordBot: {
    botToken: parseOptionalString(process.env.DISCORD_BOT_TOKEN),
    clientId: parseOptionalString(process.env.DISCORD_CLIENT_ID),
    clientSecret: parseOptionalString(process.env.DISCORD_CLIENT_SECRET),
    permissions: parseOptionalString(process.env.DISCORD_BOT_PERMISSIONS),
    scopes: parseOptionalString(process.env.DISCORD_BOT_SCOPES),
  },
  security: {
    credentialSecret: parseOptionalString(process.env.CREDENTIAL_SECRET)
      ?? parseOptionalString(process.env.DISCORD_CREDENTIAL_SECRET),
  },
  database: {
    client: process.env.DB_CLIENT ?? 'mssql',
    host: databaseConfig.host,
    port: databaseConfig.port,
    username: databaseConfig.username,
    password: databaseConfig.password,
    name: databaseConfig.name,
    encrypt: databaseConfig.encrypt,
    trustServerCertificate: databaseConfig.trustServerCertificate,
    synchronize: parseBoolean(process.env.DB_SYNCHRONIZE, true),
    dropSchema: parseBoolean(process.env.DB_DROP_SCHEMA, false),
    logging: process.env.DB_LOGGING ? parseBoolean(process.env.DB_LOGGING, false) : undefined,
  },
  sync: {
    intervalSeconds: parsePositiveInteger(
      process.env.SYNC_INTERVAL_SECONDS ?? process.env.AUTO_SYNC_INTERVAL_SECONDS,
      process.env.AUTO_SYNC_INTERVAL_MINUTES === undefined
        ? 15
        : parsePositiveInteger(process.env.AUTO_SYNC_INTERVAL_MINUTES, 30) * 60,
    ),
  },
};

export default config;
