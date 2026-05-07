import config from '../../../../config.js';
import { ServiceError } from '../../../../shared/errors/service.error.js';
import type { SysadminDiscordBotCredentialStore } from '../../../identity/infrastructure/persistence/typeorm/SysadminDiscordBotCredentialStore.js';
import type { DiscordGatewayFactory } from '../ports/DiscordGateway.js';
import type { MessagingWriteRepository } from '../../infrastructure/persistence/typeorm/MessagingWriteRepository.js';
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
    private readonly messagingWriteRepository: MessagingWriteRepository,
    private readonly discordGatewayFactory: DiscordGatewayFactory,
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
    const existingOwner = await this.messagingWriteRepository.findAnyTeacherDiscordServerCacheByDiscordServerId(
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

    const discord = this.discordGatewayFactory.create(credential.bot_token);
    const guild = await discord.fetchGuildMetadata(input.guild_id);
    const channels = await discord.listGuildChannels(input.guild_id);

    const existing = await this.messagingWriteRepository.findTeacherDiscordServerCacheByDiscordServerId(
      installState.teacher_id,
      input.guild_id,
    );
    const server = existing ?? this.messagingWriteRepository.createTeacherDiscordServerCache({
      teacher_id: installState.teacher_id,
      discord_server_id: input.guild_id,
    });
    server.name = guild.name;
    server.synced_at = new Date();
    await this.messagingWriteRepository.saveTeacherDiscordServerCache(server);
    await this.messagingWriteRepository.replaceTeacherDiscordChannelCaches(
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
