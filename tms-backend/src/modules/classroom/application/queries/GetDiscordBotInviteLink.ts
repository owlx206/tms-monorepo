import type { SysadminDiscordBotCredentialStore } from '../../../identity/infrastructure/persistence/typeorm/Writer.js';
import { findTeacherDiscordUserId } from '../../../identity/infrastructure/persistence/typeorm/Writer.js';
import {
  discordApiUrl,
  signDiscordInstallState,
} from '../../../identity/infrastructure/auth/discord-oauth.js';

export class GetDiscordBotInviteLink {
  constructor(private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore) {}

  async execute(teacherId: number): Promise<string | null> {
    const credential = await this.discordBotCredentialStore.findDefault();
    const clientId = credential?.client_id.trim() ?? '';
    if (!clientId) {
      return null;
    }

    const discordUserId = await findTeacherDiscordUserId(teacherId);
    if (!discordUserId) {
      return null;
    }

    const search = new URLSearchParams({
      client_id: clientId,
      scope: credential?.scopes?.trim() || 'bot applications.commands',
      redirect_uri: discordApiUrl('/discord/oauth/callback'),
      response_type: 'code',
      state: signDiscordInstallState({ discord_user_id: discordUserId }),
    });

    if (credential?.permissions?.trim()) {
      search.set('permissions', credential.permissions.trim());
    }

    return `https://discord.com/oauth2/authorize?${search.toString()}`;
  }
}
