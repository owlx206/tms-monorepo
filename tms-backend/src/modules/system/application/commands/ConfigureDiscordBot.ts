import type {
  DiscordBotCredentialInput,
  DiscordBotCredentialView,
} from '../../../account/contracts/types.js';
import { discordApiUrl } from '../../../../infrastructure/security/discord-oauth.js';
import type { DiscordBotCredentialStore } from '../../../account/infrastructure/persistence/typeorm/Writer.js';
import {
  DEFAULT_DISCORD_BOT_PERMISSIONS,
  DEFAULT_DISCORD_BOT_SCOPES,
} from '../../../../infrastructure/external/discord/discord.js';

function buildInviteLink(input: {
  clientId: string;
  permissions: string | null;
  scopes: string | null;
}): string {
  const search = new URLSearchParams({
    client_id: input.clientId,
    scope: input.scopes?.trim() || DEFAULT_DISCORD_BOT_SCOPES,
  });

  search.set('permissions', input.permissions?.trim() || DEFAULT_DISCORD_BOT_PERMISSIONS);

  return `https://discord.com/oauth2/authorize?${search.toString()}`;
}

export class ConfigureDiscordBot {
  constructor(private readonly store: DiscordBotCredentialStore) {}

  async execute(input: DiscordBotCredentialInput): Promise<DiscordBotCredentialView> {
    const existing = await this.store.findDefault();
    const normalizedBotToken = input.bot_token.trim();
    const botToken = normalizedBotToken && normalizedBotToken !== '__KEEP_EXISTING__'
      ? normalizedBotToken
      : existing?.bot_token ?? '';
    const normalizedClientSecret = input.client_secret.trim();
    const clientSecret = normalizedClientSecret && normalizedClientSecret !== '__KEEP_EXISTING__'
      ? normalizedClientSecret
      : existing?.client_secret ?? '';

    const saved = await this.store.saveDefault({
      bot_token: botToken,
      client_id: input.client_id.trim(),
      client_secret: clientSecret,
      permissions: input.permissions ?? null,
      scopes: input.scopes ?? null,
    });

    return {
      id: saved.id,
      client_id: saved.client_id,
      permissions: saved.permissions,
      scopes: saved.scopes,
      invite_link: buildInviteLink({
        clientId: saved.client_id,
        permissions: saved.permissions,
        scopes: saved.scopes,
      }),
      verification_redirect_uri: discordApiUrl('/discord/verification/callback'),
      install_redirect_uri: discordApiUrl('/discord/oauth/callback'),
      student_authorization_redirect_uri: discordApiUrl('/discord/student/callback'),
      has_bot_token: true,
      bot_health_status: saved.bot_health_status,
      bot_health_message: saved.bot_health_message,
      bot_health_checked_at: saved.bot_health_checked_at,
      has_client_secret: Boolean(saved.client_secret),
      updated_at: saved.updated_at,
    };
  }
}
