import config from '../../../../config.js';
import type { SysadminDiscordBotCredentialStore } from '../../../identity/index.js';
import { signDiscordInstallState } from '../../../identity/infrastructure/discord/DiscordInstallState.js';
import type { TypeOrmMessagingWriter } from '../../infrastructure/persistence/typeorm/TypeOrmMessagingWriter.js';

export class GetBotInviteLinkUseCase {
  constructor(
    private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore,
    private readonly messagingWriter: TypeOrmMessagingWriter,
  ) {}

  async execute(teacherId: number) {
    const credential = await this.discordBotCredentialStore.findDefault();
    const clientId = credential?.client_id.trim() ?? '';
    if (!clientId) {
      return null;
    }
    const discordUserId = await this.messagingWriter.getTeacherDiscordUserId(teacherId);
    if (!discordUserId) {
      return null;
    }

    const redirectUri = `${config.backendPublicUrl}${config.apiPrefix}/discord/oauth/callback`;
    const search = new URLSearchParams({
      client_id: clientId,
      scope: credential?.scopes?.trim() || 'bot applications.commands',
      redirect_uri: redirectUri,
      response_type: 'code',
      state: signDiscordInstallState({ discord_user_id: discordUserId }),
    });

    if (credential?.permissions?.trim()) {
      search.set('permissions', credential.permissions.trim());
    }

    return `https://discord.com/oauth2/authorize?${search.toString()}`;
  }
}
