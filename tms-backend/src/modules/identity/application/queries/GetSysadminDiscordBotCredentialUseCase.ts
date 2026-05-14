import config from '../../../../config.js';
import type { SysadminDiscordBotCredentialView } from '../dto/AdminDto.js';
import type { SysadminDiscordBotCredentialStore } from '../../infrastructure/persistence/typeorm/SysadminDiscordBotCredentialStore.js';

function buildInviteLink(input: {
  clientId: string;
  permissions: string | null;
  scopes: string | null;
}): string {
  const search = new URLSearchParams({
    client_id: input.clientId,
    scope: input.scopes?.trim() || 'bot applications.commands',
  });

  if (input.permissions?.trim()) {
    search.set('permissions', input.permissions.trim());
  }

  return `https://discord.com/oauth2/authorize?${search.toString()}`;
}

export class GetSysadminDiscordBotCredentialUseCase {
  constructor(private readonly store: SysadminDiscordBotCredentialStore) {}

  async execute(): Promise<SysadminDiscordBotCredentialView | null> {
    const credential = await this.store.findDefault();
    if (!credential) {
      return null;
    }

    return {
      id: credential.id,
      client_id: credential.client_id,
      permissions: credential.permissions,
      scopes: credential.scopes,
      invite_link: buildInviteLink({
        clientId: credential.client_id,
        permissions: credential.permissions,
        scopes: credential.scopes,
      }),
      verification_redirect_uri: `${config.backendPublicUrl}${config.apiPrefix}/discord/verification/callback`,
      has_bot_token: Boolean(credential.bot_token),
      has_client_secret: Boolean(credential.client_secret),
      updated_at: credential.updated_at,
    };
  }
}
