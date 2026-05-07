import jwt from 'jsonwebtoken';

import config from '../../../../config.js';
import { AuthError } from '../../../../shared/errors/auth.error.js';

type DiscordVerificationStatePayload = {
  teacher_id: number;
};

const DISCORD_VERIFICATION_AUDIENCE = 'discord-verification';

export function signDiscordVerificationState(payload: DiscordVerificationStatePayload): string {
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: '15m',
    issuer: config.auth.jwtIssuer,
    audience: DISCORD_VERIFICATION_AUDIENCE,
  });
}

export function verifyDiscordVerificationState(state: string): DiscordVerificationStatePayload {
  try {
    const decoded = jwt.verify(state, config.auth.jwtSecret, {
      issuer: config.auth.jwtIssuer,
      audience: DISCORD_VERIFICATION_AUDIENCE,
    });

    if (typeof decoded !== 'object' || decoded === null || typeof decoded.teacher_id !== 'number') {
      throw new AuthError('invalid discord verification state', 400);
    }

    return {
      teacher_id: decoded.teacher_id,
    };
  } catch {
    throw new AuthError('invalid or expired discord verification state', 400);
  }
}
