import { DiscordRecipientResolver } from '../../../../infrastructure/external/discord/discord-recipient-resolver.js';
import type { DiscordServerContext, ResolvedDiscordRecipient } from './discord.types.js';

export class DefaultDiscordRecipientResolver {
  constructor(
    private readonly defaultBotToken: string | null | undefined = null,
    private readonly discordRecipientResolver = new DiscordRecipientResolver(),
  ) {}

  resolve(server: DiscordServerContext, discordUsername: string | null): Promise<ResolvedDiscordRecipient> {
    return this.discordRecipientResolver.resolve(
      {
        ...server,
        class_id: server.class_id ?? 0,
        bot_token: server.bot_token?.trim() || this.defaultBotToken?.trim() || null,
      },
      discordUsername,
    );
  }
}
