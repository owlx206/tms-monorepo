import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { ValueTransformer } from 'typeorm';

import config from '../../config.js';

const ENCRYPTED_PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getCredentialSecret(): string {
  return config.security.credentialSecret ?? config.auth.jwtSecret ?? 'local-discord-credential-secret';
}

function getCredentialSecrets(): string[] {
  return Array.from(new Set([
    getCredentialSecret(),
    config.auth.jwtSecret,
    'local-discord-credential-secret',
  ].filter((secret): secret is string => Boolean(secret))));
}

function getEncryptionKey(secret = getCredentialSecret()): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function encodeCredential(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined || value === '') {
    return value;
  }

  if (value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${Buffer.concat([iv, authTag, ciphertext]).toString('base64')}`;
}

export function decodeCredential(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined || value === '' || !value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }

  const payload = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), 'base64');
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  for (const secret of getCredentialSecrets()) {
    try {
      const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(secret), iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
      // Try the next historical secret so existing local credentials remain readable.
    }
  }

  throw new Error('failed to decrypt credential');
}

export const credentialTransformer: ValueTransformer = {
  to: encodeCredential,
  from: decodeCredential,
};
