import config from '../../../../config.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';
import type {
  CompleteTeacherDiscordVerificationInput,
  DiscordTokenPayload,
  DiscordUserPayload,
} from '../../contracts/types.js';
import { verifyDiscordVerificationState } from '../../infrastructure/auth/DiscordVerificationState.js';
import type { SysadminDiscordBotCredentialStore, TypeOrmTeacherWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

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
    throw new HttpError('failed to connect to Discord OAuth API', 502);
  }

  if (!response.ok) {
    throw new HttpError('failed to complete Discord verification', 502);
  }

  const payload = await response.json() as DiscordTokenPayload;
  if (!payload.access_token || payload.token_type?.toLowerCase() !== 'bearer') {
    throw new HttpError('invalid Discord OAuth token response', 502);
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

export class CompleteTeacherDiscordVerificationUseCase {
  constructor(
    private readonly teacherWriter: TypeOrmTeacherWriter,
    private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore,
  ) {}

  async execute(input: CompleteTeacherDiscordVerificationInput): Promise<string> {
    if (input.error) {
      return `${config.frontendUrl}/messaging?discord_verification=cancelled`;
    }

    if (!input.code || !input.state) {
      throw new HttpError('discord verification callback is missing required parameters', 400);
    }

    const credential = await this.discordBotCredentialStore.findDefault();
    if (!credential?.client_id || !credential.client_secret) {
      throw new HttpError('discord is not available right now', 503);
    }

    const verificationState = verifyDiscordVerificationState(input.state);
    const teacher = await this.teacherWriter.findById(verificationState.teacher_id);
    if (!teacher) {
      throw new HttpError('teacher not found', 404);
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
