import config from '../../../../config.js';
import { DiscordClient } from '../../../../infrastructure/external/discord/discord-api.service.js';
import { ServiceError } from '../../../../shared/errors/service.error.js';
import { isDomainError } from '../../../../shared/errors/domain.error.js';
import type { SysadminDiscordBotCredentialStore } from '../../infrastructure/persistence/typeorm/SysadminDiscordBotCredentialStore.js';
import { verifyDiscordInstallState } from '../../infrastructure/discord/DiscordInstallState.js';
import type { TypeOrmDiscordUserGuildStore } from '../../infrastructure/persistence/typeorm/TypeOrmDiscordUserGuildStore.js';

export class CompleteDiscordGuildInstallUseCase {
  constructor(
    private readonly userGuildStore: TypeOrmDiscordUserGuildStore,
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

    if (!input.state || !input.guild_id) {
      return `${config.frontendUrl}/messaging?discord_install=invalid_callback`;
    }

    const credential = await this.discordBotCredentialStore.findDefault();
    if (!credential?.bot_token) {
      throw new ServiceError('discord is not available right now', 503);
    }

    let discordUserId: string;
    try {
      const installState = verifyDiscordInstallState(input.state);
      discordUserId = installState.discord_user_id;
    } catch (error) {
      if (isDomainError(error)) {
        return `${config.frontendUrl}/messaging?discord_install=invalid_state`;
      }

      throw error;
    }

    const existingUserGuild = await this.userGuildStore.findAnyByDiscordGuildId(input.guild_id);
    if (existingUserGuild && existingUserGuild.discord_user_id !== discordUserId) {
      return `${config.frontendUrl}/messaging?discord_install=conflict`;
    }

    const discord = new DiscordClient(credential.bot_token);
    const guild = await discord.fetchGuildMetadata(input.guild_id);
    const channels = await discord.listGuildChannels(input.guild_id);

    const existing = await this.userGuildStore.findByOwnerAndDiscordGuildId(
      discordUserId,
      input.guild_id,
    );
    const userGuild = existing ?? this.userGuildStore.createUserGuild({
      discord_user_id: discordUserId,
      discord_guild_id: input.guild_id,
    });
    userGuild.name = guild.name;
    userGuild.synced_at = new Date();
    await this.userGuildStore.saveUserGuild(userGuild);
    await this.userGuildStore.replaceChannelCache(
      discordUserId,
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
