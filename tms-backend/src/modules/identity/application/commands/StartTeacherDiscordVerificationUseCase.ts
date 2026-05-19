import config from '../../../../config.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';
import { signDiscordVerificationState } from '../../infrastructure/auth/DiscordVerificationState.js';
import type { SysadminDiscordBotCredentialStore } from '../../infrastructure/persistence/typeorm/Writer.js';

export class StartTeacherDiscordVerificationUseCase {
  constructor(private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore) {}

  async execute(teacherId: number): Promise<string> {
    const credential = await this.discordBotCredentialStore.findDefault();
    if (!credential?.client_id || !credential.client_secret) {
      throw new HttpError('discord is not available right now', 503);
    }

    const search = new URLSearchParams({
      client_id: credential.client_id,
      response_type: 'code',
      redirect_uri: `${config.backendPublicUrl}${config.apiPrefix}/discord/verification/callback`,
      scope: 'identify',
      state: signDiscordVerificationState({ teacher_id: teacherId }),
    });

    return `https://discord.com/oauth2/authorize?${search.toString()}`;
  }
}
