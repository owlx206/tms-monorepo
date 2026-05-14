import type { SysadminDiscordBotCredentialStore } from '../../../identity/index.js';

export class GetBotInviteLinkUseCase {
  constructor(private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore) {}

  async execute(_teacherId: number) {
    const credential = await this.discordBotCredentialStore.findDefault();
    const clientId = credential?.client_id.trim() ?? '';
    if (!clientId) {
      return null;
    }

    const search = new URLSearchParams({
      client_id: clientId,
      scope: credential?.scopes?.trim() || 'bot applications.commands',
    });

    if (credential?.permissions?.trim()) {
      search.set('permissions', credential.permissions.trim());
    }

    return `https://discord.com/oauth2/authorize?${search.toString()}`;
  }
}
