import { HttpError } from '../../../../shared/errors/HttpError.js';

type DiscordTokenPayload = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
};

type DiscordUserPayload = {
  id?: string;
  username?: string;
  global_name?: string | null;
};

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
  let response: Response;
  try {
    response = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        grant_type: 'authorization_code',
        code: input.code,
        redirect_uri: input.redirectUri,
      }),
    });
  } catch {
    throw new HttpError('failed to connect to Discord OAuth API', 502);
  }

  if (!response.ok) {
    throw new HttpError('failed to complete student Discord authorization', 502);
  }

  return toTokenSet(await response.json() as DiscordTokenPayload);
}

export async function refreshStudentDiscordToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<StudentDiscordTokenSet> {
  let response: Response;
  try {
    response = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: input.refreshToken,
      }),
    });
  } catch {
    throw new HttpError('failed to connect to Discord OAuth API', 502);
  }

  if (!response.ok) {
    throw new HttpError('failed to refresh student Discord authorization', 401);
  }

  return toTokenSet(await response.json() as DiscordTokenPayload);
}

export async function fetchStudentDiscordUser(accessToken: string): Promise<{
  id: string;
  username: string;
}> {
  let response: Response;
  try {
    response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw new HttpError('failed to fetch Discord user profile', 502);
  }

  if (!response.ok) {
    throw new HttpError('failed to fetch Discord user profile', 502);
  }

  const payload = await response.json() as DiscordUserPayload;
  if (!payload.id || !payload.username) {
    throw new HttpError('invalid Discord user profile response', 502);
  }

  return {
    id: payload.id,
    username: payload.username,
  };
}
