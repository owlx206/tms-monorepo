import config from '../../../../config.js';
import { TypeOrmSysadminDiscordBotCredentialStore } from '../../../account/infrastructure/persistence/typeorm/Writer.js';

const discordBotCredentialStore = new TypeOrmSysadminDiscordBotCredentialStore();

export async function ensureDiscordBotConfig(): Promise<void> {
  const { botToken, clientId, clientSecret, permissions, scopes } = config.discordBot;

  if (!botToken && !clientId && !clientSecret) {
    return;
  }

  if (!botToken || !clientId || !clientSecret) {
    throw new Error(
      'Discord bot bootstrap requires DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, and DISCORD_CLIENT_SECRET when any DISCORD_* bot config is set.',
    );
  }

  await discordBotCredentialStore.saveDefault({
    bot_token: botToken,
    client_id: clientId,
    client_secret: clientSecret,
    permissions: permissions ?? null,
    scopes: scopes ?? null,
  });
}
