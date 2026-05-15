import jwt from 'jsonwebtoken';

import config from '../../../../config.js';
import { AuthError } from '../../../../shared/errors/auth.error.js';

type StudentDiscordAuthorizationStatePayload = {
  teacher_id: number;
  student_id: number;
};

const STUDENT_DISCORD_AUTHORIZATION_AUDIENCE = 'student-discord-authorization';

export function signStudentDiscordAuthorizationState(
  payload: StudentDiscordAuthorizationStatePayload,
): string {
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: '30m',
    issuer: config.auth.jwtIssuer,
    audience: STUDENT_DISCORD_AUTHORIZATION_AUDIENCE,
  });
}

export function verifyStudentDiscordAuthorizationState(state: string): StudentDiscordAuthorizationStatePayload {
  try {
    const decoded = jwt.verify(state, config.auth.jwtSecret, {
      issuer: config.auth.jwtIssuer,
      audience: STUDENT_DISCORD_AUTHORIZATION_AUDIENCE,
    });

    if (
      typeof decoded !== 'object'
      || decoded === null
      || typeof decoded.teacher_id !== 'number'
      || typeof decoded.student_id !== 'number'
    ) {
      throw new AuthError('invalid student discord authorization state', 400);
    }

    return {
      teacher_id: decoded.teacher_id,
      student_id: decoded.student_id,
    };
  } catch {
    throw new AuthError('invalid or expired student discord authorization state', 400);
  }
}
