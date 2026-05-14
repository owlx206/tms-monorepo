import { ServiceError } from '../../../../shared/errors/service.error.js';
import { DiscordClient } from '../../../../infrastructure/external/discord/discord-api.service.js';
import type {
  ChannelMessagePayload,
  DirectMessagePayload,
  DiscordChannelOwnershipCheck,
  DiscordGuildChannel,
  DiscordGuildMetadata,
} from './discord.types.js';
import type { SysadminDiscordBotCredentialStore } from '../../../identity/index.js';

export class StoredDiscordGateway {
  constructor(private readonly store: SysadminDiscordBotCredentialStore) {}

  private async getClient(botToken?: string | null): Promise<DiscordClient> {
    const provided = botToken?.trim();
    if (provided) {
      return new DiscordClient(provided);
    }

    const credential = await this.store.findDefault();
    const stored = credential?.bot_token?.trim();
    if (!stored) {
      throw new ServiceError('discord bot is not configured by sysadmin', 503);
    }

    return new DiscordClient(stored);
  }

  async listGuilds(botToken?: string | null): Promise<DiscordGuildMetadata[]> {
    return (await this.getClient(botToken)).listGuilds();
  }

  async fetchGuildMetadata(
    discordServerId: string,
    botToken?: string | null,
  ): Promise<DiscordGuildMetadata> {
    return (await this.getClient(botToken)).fetchGuildMetadata(discordServerId);
  }

  async listGuildChannels(guildId: string, botToken?: string | null): Promise<DiscordGuildChannel[]> {
    return (await this.getClient(botToken)).listGuildChannels(guildId);
  }

  async ensureChannelBelongsToGuild(
    input: DiscordChannelOwnershipCheck,
    botToken?: string | null,
  ): Promise<void> {
    return (await this.getClient(botToken)).ensureChannelBelongsToGuild(input);
  }

  async sendDirectMessage(input: DirectMessagePayload, botToken?: string | null): Promise<unknown> {
    return (await this.getClient(botToken)).sendDirectMessage(input);
  }

  async postChannelMessage(input: ChannelMessagePayload, botToken?: string | null): Promise<unknown> {
    return (await this.getClient(botToken)).postChannelMessage(input);
  }
}
