import type { DiscordBotCredentialStore } from '../../../account/infrastructure/persistence/typeorm/Writer.js';
import { findTeacherDiscordUserId } from '../../../account/infrastructure/persistence/typeorm/Writer.js';
import {
  discordApiUrl,
  signDiscordInstallState,
} from '../../../../infrastructure/security/discord-oauth.js';
import {
  DEFAULT_DISCORD_BOT_PERMISSIONS,
  DEFAULT_DISCORD_BOT_SCOPES,
} from '../../../../infrastructure/external/discord/discord.js';

export class GetDiscordBotInviteLink {
  constructor(private readonly discordBotCredentialStore: DiscordBotCredentialStore) {}

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
      scope: credential?.scopes?.trim() || DEFAULT_DISCORD_BOT_SCOPES,
      redirect_uri: discordApiUrl('/discord/oauth/callback'),
      response_type: 'code',
      state: signDiscordInstallState({ discord_user_id: discordUserId }),
    });

    search.set('permissions', credential?.permissions?.trim() || DEFAULT_DISCORD_BOT_PERMISSIONS);

    return `https://discord.com/oauth2/authorize?${search.toString()}`;
  }
}
