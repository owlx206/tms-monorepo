import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function readEnvFileValue(key: string): string | undefined {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../.env'),
    join(sourceDir, '../../.env'),
    join(sourceDir, '../../../.env'),
  ];
  const envPath = candidates.find((candidate) => existsSync(candidate));
  if (!envPath) {
    return undefined;
  }

  const rows = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const row of rows) {
    const trimmed = row.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const envKey = trimmed.slice(0, separatorIndex).trim();
    if (envKey !== key) {
      continue;
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    return rawValue.replace(/^(['"])(.*)\1$/, '$2');
  }

  return undefined;
}

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

const config = {
  nodeEnv: process.env.NODE_ENV,
  host: process.env.HOST,
  port: Number(process.env.PORT),
  apiPrefix: process.env.API_PREFIX as string,
  frontendUrl: parseOptionalString(process.env.FRONTEND_PUBLIC_URL)
    ?? parseOptionalString(process.env.FRONTEND_URL)
    ?? `http://localhost:${parsePositiveInteger(process.env.FRONTEND_PORT, 5173)}`,
  backendPublicUrl: parseOptionalString(process.env.BACKEND_PUBLIC_URL)
    ?? parseOptionalString(readEnvFileValue('BACKEND_PUBLIC_URL'))
    ?? `http://localhost:${parsePositiveInteger(process.env.PORT ?? process.env.BACKEND_PORT, 4000)}`,
  auth: {
    jwtSecret: process.env.JWT_SECRET as string,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN,
    jwtIssuer: process.env.JWT_ISSUER,
    jwtAudience: process.env.JWT_AUDIENCE,
    bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS),
    allowPublicRegistration: parseBoolean(process.env.AUTH_ALLOW_PUBLIC_REGISTRATION, false),
    sysAdminUsername: process.env.SYSADMIN_USERNAME ?? 'admin',
    sysAdminPassword: parseOptionalString(process.env.SYSADMIN_PASSWORD),
  },
  security: {
    credentialSecret: parseOptionalString(process.env.CREDENTIAL_SECRET)
      ?? parseOptionalString(process.env.DISCORD_CREDENTIAL_SECRET),
  },
  database: {
    client: process.env.DB_CLIENT ?? 'mssql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
    encrypt: parseBoolean(process.env.DB_ENCRYPT, false),
    trustServerCertificate: parseBoolean(process.env.DB_TRUST_SERVER_CERTIFICATE, false),
    synchronize: parseBoolean(process.env.DB_SYNCHRONIZE, true),
    dropSchema: parseBoolean(process.env.DB_DROP_SCHEMA, false),
    logging: process.env.DB_LOGGING ? parseBoolean(process.env.DB_LOGGING, false) : undefined,
  },
  autoSync: {
    enabled: parseBoolean(process.env.AUTO_SYNC_ENABLED, true),
    intervalSeconds: parsePositiveInteger(
      process.env.AUTO_SYNC_INTERVAL_SECONDS,
      process.env.AUTO_SYNC_INTERVAL_MINUTES === undefined
        ? 15
        : parsePositiveInteger(process.env.AUTO_SYNC_INTERVAL_MINUTES, 30) * 60,
    ),
    syncDiscord: parseBoolean(process.env.AUTO_SYNC_DISCORD_ENABLED, true),
    syncCodeforces: parseBoolean(process.env.AUTO_SYNC_CODEFORCES_ENABLED, true),
  },
  voiceAttendanceSync: {
    enabled: parseBoolean(process.env.VOICE_ATTENDANCE_SYNC_ENABLED, true),
    intervalSeconds: parsePositiveInteger(process.env.VOICE_ATTENDANCE_SYNC_INTERVAL_SECONDS, 15),
  },
  sessionStatusSync: {
    enabled: parseBoolean(process.env.SESSION_STATUS_SYNC_ENABLED, true),
    intervalSeconds: parsePositiveInteger(process.env.SESSION_STATUS_SYNC_INTERVAL_SECONDS, 15),
  },
  codeforcesStandingSync: {
    intervalSeconds: parsePositiveInteger(process.env.CODEFORCES_STANDING_SYNC_INTERVAL_SECONDS, 15),
  },
};

export default config;
