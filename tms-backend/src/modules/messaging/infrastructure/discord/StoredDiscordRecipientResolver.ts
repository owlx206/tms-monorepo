import { DiscordRecipientResolver } from '../../../../infrastructure/external/discord/discord-recipient-resolver.js';
import type { DiscordServerContext, ResolvedDiscordRecipient } from './discord.types.js';
import type { SysadminDiscordBotCredentialStore } from '../../../identity/index.js';

export class StoredDiscordRecipientResolver {
  constructor(
    private readonly store: SysadminDiscordBotCredentialStore,
    private readonly resolver = new DiscordRecipientResolver(),
  ) {}

  async resolve(server: DiscordServerContext, discordUsername: string | null): Promise<ResolvedDiscordRecipient> {
    const credential = await this.store.findDefault();

    return this.resolver.resolve(
      {
        ...server,
        class_id: server.class_id ?? 0,
        bot_token: server.bot_token?.trim() || credential?.bot_token?.trim() || null,
      },
      discordUsername,
    );
  }
}
