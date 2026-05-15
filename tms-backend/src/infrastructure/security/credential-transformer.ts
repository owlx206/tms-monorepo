import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { ValueTransformer } from 'typeorm';

import config from '../../config.js';

const ENCRYPTED_PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getCredentialSecret(): string {
  return config.discord.credentialSecret ?? config.auth.jwtSecret ?? 'local-discord-credential-secret';
}

function getEncryptionKey(): Buffer {
  return createHash('sha256').update(getCredentialSecret()).digest();
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
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export const credentialTransformer: ValueTransformer = {
  to: encodeCredential,
  from: decodeCredential,
};
