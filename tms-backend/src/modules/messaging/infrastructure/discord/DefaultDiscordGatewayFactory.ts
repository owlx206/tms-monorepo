import { ServiceError } from '../../../../shared/errors/service.error.js';
import { DiscordClient } from '../../../../infrastructure/external/discord/discord-api.service.js';
import type {
  ChannelMessagePayload,
  DirectMessagePayload,
  DiscordChannelOwnershipCheck,
  DiscordGuildChannel,
  DiscordGuildMetadata,
} from './discord.types.js';

class DiscordClientGateway {
  constructor(private readonly discordClient: DiscordClient) {}

  listGuilds(): Promise<DiscordGuildMetadata[]> {
    return this.discordClient.listGuilds();
  }

  fetchGuildMetadata(discordServerId: string): Promise<DiscordGuildMetadata> {
    return this.discordClient.fetchGuildMetadata(discordServerId);
  }

  listGuildChannels(guildId: string): Promise<DiscordGuildChannel[]> {
    return this.discordClient.listGuildChannels(guildId);
  }

  ensureChannelBelongsToGuild(input: DiscordChannelOwnershipCheck): Promise<void> {
    return this.discordClient.ensureChannelBelongsToGuild(input);
  }

  sendDirectMessage(input: DirectMessagePayload): Promise<unknown> {
    return this.discordClient.sendDirectMessage(input);
  }

  postChannelMessage(input: ChannelMessagePayload): Promise<unknown> {
    return this.discordClient.postChannelMessage(input);
  }
}

export class DefaultDiscordGatewayFactory {
  constructor(private readonly defaultBotToken: string | null | undefined = null) {}

  create(botToken?: string | null): DiscordClientGateway {
    const resolvedBotToken = botToken?.trim() || this.defaultBotToken?.trim() || null;
    if (!resolvedBotToken) {
      throw new ServiceError('discord bot is not configured by sysadmin', 503);
    }

    return new DiscordClientGateway(new DiscordClient(resolvedBotToken));
  }
}
