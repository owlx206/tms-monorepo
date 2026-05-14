import config from '../../../../config.js';
import { ServiceError } from '../../../../shared/errors/service.error.js';
import type { SysadminDiscordBotCredentialStore } from '../../../identity/index.js';
import type { StoredDiscordGateway } from '../../infrastructure/discord/StoredDiscordGateway.js';
import type { TypeOrmMessagingWriter } from '../../infrastructure/persistence/typeorm/TypeOrmMessagingWriter.js';
import { verifyDiscordInstallState } from '../../infrastructure/discord/DiscordInstallState.js';

async function exchangeDiscordOAuthCode(input: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<void> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
  });

  let response: Response;
  try {
    response = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
  } catch {
    throw new ServiceError('failed to connect to Discord OAuth API', 502);
  }

  if (!response.ok) {
    throw new ServiceError('failed to complete Discord OAuth install', 502);
  }
}

export class CompleteDiscordGuildInstallUseCase {
  constructor(
    private readonly messagingWriter: TypeOrmMessagingWriter,
    private readonly discordGateway: StoredDiscordGateway,
    private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore,
  ) {}

  async execute(input: {
    code?: string;
    state?: string;
    guild_id?: string;
    error?: string;
  }): Promise<string> {
    if (input.error) {
      return `${config.frontendUrl}/messaging?discord_install=cancelled`;
    }

    if (!input.code || !input.state || !input.guild_id) {
      throw new ServiceError('discord install callback is missing required parameters', 400);
    }

    const credential = await this.discordBotCredentialStore.findDefault();
    if (!credential?.client_id || !credential.client_secret || !credential.bot_token) {
      throw new ServiceError('discord bot is not configured by sysadmin', 503);
    }

    const installState = verifyDiscordInstallState(input.state);
    const existingOwner = await this.messagingWriter.findAnyTeacherDiscordServerCacheByDiscordServerId(
      input.guild_id,
    );
    if (existingOwner && existingOwner.teacher_id !== installState.teacher_id) {
      return `${config.frontendUrl}/messaging?discord_install=conflict`;
    }

    const redirectUri = `${config.backendPublicUrl}${config.apiPrefix}/discord/oauth/callback`;
    await exchangeDiscordOAuthCode({
      code: input.code,
      redirectUri,
      clientId: credential.client_id,
      clientSecret: credential.client_secret,
    });

    const guild = await this.discordGateway.fetchGuildMetadata(input.guild_id, credential.bot_token);
    const channels = await this.discordGateway.listGuildChannels(input.guild_id, credential.bot_token);

    const existing = await this.messagingWriter.findTeacherDiscordServerCacheByDiscordServerId(
      installState.teacher_id,
      input.guild_id,
    );
    const server = existing ?? this.messagingWriter.createTeacherDiscordServerCache({
      teacher_id: installState.teacher_id,
      discord_server_id: input.guild_id,
    });
    server.name = guild.name;
    server.synced_at = new Date();
    await this.messagingWriter.saveTeacherDiscordServerCache(server);
    await this.messagingWriter.replaceTeacherDiscordChannelCaches(
      installState.teacher_id,
      input.guild_id,
      channels.map((channel) => ({
        discord_channel_id: channel.id,
        name: channel.name,
        type: channel.type,
      })),
    );

    return `${config.frontendUrl}/messaging?discord_install=success`;
  }
}
