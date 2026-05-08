import { ServiceError } from '../../../../shared/errors/service.error.js';
import { DiscordClient } from '../../../../integrations/discord/discord-api.service.js';
import type {
  ChannelMessagePayload,
  DirectMessagePayload,
  DiscordChannelOwnershipCheck,
  DiscordGateway,
  DiscordGatewayFactory,
  DiscordGuildChannel,
  DiscordGuildMetadata,
} from '../../application/ports/DiscordGateway.js';
import type { SysadminDiscordBotCredentialStore } from '../../../identity/index.js';

class StoredDiscordGateway implements DiscordGateway {
  constructor(
    private readonly store: SysadminDiscordBotCredentialStore,
    private readonly explicitBotToken?: string | null,
  ) {}

  private async getClient(): Promise<DiscordClient> {
    const provided = this.explicitBotToken?.trim();
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

  async listGuilds(): Promise<DiscordGuildMetadata[]> {
    return (await this.getClient()).listGuilds();
  }

  async fetchGuildMetadata(discordServerId: string): Promise<DiscordGuildMetadata> {
    return (await this.getClient()).fetchGuildMetadata(discordServerId);
  }

  async listGuildChannels(guildId: string): Promise<DiscordGuildChannel[]> {
    return (await this.getClient()).listGuildChannels(guildId);
  }

  async ensureChannelBelongsToGuild(input: DiscordChannelOwnershipCheck): Promise<void> {
    return (await this.getClient()).ensureChannelBelongsToGuild(input);
  }

  async sendDirectMessage(input: DirectMessagePayload): Promise<unknown> {
    return (await this.getClient()).sendDirectMessage(input);
  }

  async postChannelMessage(input: ChannelMessagePayload): Promise<unknown> {
    return (await this.getClient()).postChannelMessage(input);
  }
}

export class StoredDiscordGatewayFactory implements DiscordGatewayFactory {
  constructor(private readonly store: SysadminDiscordBotCredentialStore) {}

  create(botToken?: string | null): DiscordGateway {
    return new StoredDiscordGateway(this.store, botToken);
  }
}
