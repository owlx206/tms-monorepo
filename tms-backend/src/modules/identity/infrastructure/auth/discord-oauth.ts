import jwt from 'jsonwebtoken';

import config from '../../../../config.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';
import {
  exchangeDiscordOAuthCode,
  fetchDiscordCurrentUser,
  refreshDiscordOAuthToken,
  type DiscordTokenPayload,
} from '../../../../infrastructure/external/discord/discord.js';

// --- Public URL helpers ---

export function discordApiUrl(path: string): string {
  return `${config.discordFallbackURL}${config.apiPrefix}${path}`;
}

export function discordFrontendUrl(path: string): string {
  return `${config.discordFallbackURL}${path}`;
}

// --- Teacher Discord verification state (JWT-signed) ---

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
      throw new HttpError('invalid discord verification state', 400);
    }

    return {
      teacher_id: decoded.teacher_id,
    };
  } catch {
    throw new HttpError('invalid or expired discord verification state', 400);
  }
}

// --- Student Discord authorization state (JWT-signed) ---

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
      throw new HttpError('invalid student discord authorization state', 400);
    }

    return {
      teacher_id: decoded.teacher_id,
      student_id: decoded.student_id,
    };
  } catch {
    throw new HttpError('invalid or expired student discord authorization state', 400);
  }
}

// --- Discord guild install state ---

type DiscordInstallStatePayload = {
  discord_user_id: string;
};

export function signDiscordInstallState(payload: DiscordInstallStatePayload): string {
  return payload.discord_user_id;
}

export function verifyDiscordInstallState(state: string): DiscordInstallStatePayload {
  const discordUserId = state.trim();
  if (!/^\d{15,25}$/.test(discordUserId)) {
    throw new HttpError('invalid discord install state', 400);
  }

  return {
    discord_user_id: discordUserId,
  };
}

// --- Student Discord OAuth token exchange ---

export type StudentDiscordTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

function toTokenSet(payload: DiscordTokenPayload): StudentDiscordTokenSet {
  if (
    !payload.access_token
    || !payload.refresh_token
    || payload.token_type?.toLowerCase() !== 'bearer'
  ) {
    throw new HttpError('invalid Discord OAuth token response', 502);
  }

  const expiresInSeconds = Number.isInteger(payload.expires_in) && (payload.expires_in ?? 0) > 0
    ? payload.expires_in ?? 3600
    : 3600;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
  };
}

export async function exchangeStudentDiscordCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<StudentDiscordTokenSet> {
  return toTokenSet(await exchangeDiscordOAuthCode(input));
}

export async function refreshStudentDiscordToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<StudentDiscordTokenSet> {
  return toTokenSet(await refreshDiscordOAuthToken(input));
}

export async function fetchStudentDiscordUser(accessToken: string): Promise<{
  id: string;
  username: string;
}> {
  return fetchDiscordCurrentUser(accessToken);
}
