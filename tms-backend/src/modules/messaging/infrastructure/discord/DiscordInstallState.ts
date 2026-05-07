import jwt from 'jsonwebtoken';

import config from '../../../../config.js';
import { ServiceError } from '../../../../shared/errors/service.error.js';

type DiscordInstallStatePayload = {
  teacher_id: number;
};

const DISCORD_INSTALL_STATE_AUDIENCE = 'discord-install-state';

export function signDiscordInstallState(payload: DiscordInstallStatePayload): string {
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: '15m',
    issuer: config.auth.jwtIssuer,
    audience: DISCORD_INSTALL_STATE_AUDIENCE,
  });
}

export function verifyDiscordInstallState(state: string): DiscordInstallStatePayload {
  try {
    const decoded = jwt.verify(state, config.auth.jwtSecret, {
      issuer: config.auth.jwtIssuer,
      audience: DISCORD_INSTALL_STATE_AUDIENCE,
    });

    if (typeof decoded !== 'object' || decoded === null || typeof decoded.teacher_id !== 'number') {
      throw new ServiceError('invalid discord install state', 400);
    }

    return {
      teacher_id: decoded.teacher_id,
    };
  } catch {
    throw new ServiceError('invalid or expired discord install state', 400);
  }
}
