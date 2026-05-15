import config from '../../../../config.js';
import { AuthError } from '../../../../shared/errors/auth.error.js';
import { verifyDiscordVerificationState } from '../../infrastructure/auth/DiscordVerificationState.js';
import type { SysadminDiscordBotCredentialStore } from '../../infrastructure/persistence/typeorm/SysadminDiscordBotCredentialStore.js';
import type { TypeOrmTeacherWriter } from '../../infrastructure/persistence/typeorm/TypeOrmTeacherWriter.js';

type DiscordTokenPayload = {
  access_token?: string;
  token_type?: string;
};

type DiscordUserPayload = {
  id?: string;
  username?: string;
};

async function exchangeDiscordCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<string> {
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
    throw new AuthError('failed to connect to Discord OAuth API', 502);
  }

  if (!response.ok) {
    throw new AuthError('failed to complete Discord verification', 502);
  }

  const payload = await response.json() as DiscordTokenPayload;
  if (!payload.access_token || payload.token_type?.toLowerCase() !== 'bearer') {
    throw new AuthError('invalid Discord OAuth token response', 502);
  }

  return payload.access_token;
}

async function fetchDiscordUser(accessToken: string): Promise<{ id: string; username: string }> {
  let response: Response;
  try {
    response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw new AuthError('failed to fetch Discord user profile', 502);
  }

  if (!response.ok) {
    throw new AuthError('failed to fetch Discord user profile', 502);
  }

  const payload = await response.json() as DiscordUserPayload;
  if (!payload.id || !payload.username) {
    throw new AuthError('invalid Discord user profile response', 502);
  }

  return {
    id: payload.id,
    username: payload.username,
  };
}

export class CompleteTeacherDiscordVerificationUseCase {
  constructor(
    private readonly teacherWriter: TypeOrmTeacherWriter,
    private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore,
  ) {}

  async execute(input: {
    code?: string;
    state?: string;
    error?: string;
  }): Promise<string> {
    if (input.error) {
      return `${config.frontendUrl}/messaging?discord_verification=cancelled`;
    }

    if (!input.code || !input.state) {
      throw new AuthError('discord verification callback is missing required parameters', 400);
    }

    const credential = await this.discordBotCredentialStore.findDefault();
    if (!credential?.client_id || !credential.client_secret) {
      throw new AuthError('discord oauth is not configured by sysadmin', 503);
    }

    const verificationState = verifyDiscordVerificationState(input.state);
    const teacher = await this.teacherWriter.findById(verificationState.teacher_id);
    if (!teacher) {
      throw new AuthError('teacher not found', 404);
    }

    const accessToken = await exchangeDiscordCode({
      code: input.code,
      clientId: credential.client_id,
      clientSecret: credential.client_secret,
      redirectUri: `${config.backendPublicUrl}${config.apiPrefix}/discord/verification/callback`,
    });
    const discordUser = await fetchDiscordUser(accessToken);
    if (teacher.discord_user_id && teacher.discord_user_id !== discordUser.id) {
      await this.teacherWriter.clearDiscordWorkspaceData(teacher.id, teacher.discord_user_id);
    }

    teacher.discord_user_id = discordUser.id;
    teacher.discord_username = discordUser.username;
    teacher.discord_verified_at = new Date();
    await this.teacherWriter.save(teacher);

    return `${config.frontendUrl}/messaging?discord_verification=success`;
  }
}
