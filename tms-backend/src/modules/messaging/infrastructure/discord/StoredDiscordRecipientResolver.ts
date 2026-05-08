import { DiscordRecipientResolver } from '../../../../integrations/discord/discord-recipient-resolver.js';
import type {
  DiscordRecipientResolverPort,
  DiscordServerContext,
} from '../../application/ports/DiscordRecipientResolverPort.js';
import type { SysadminDiscordBotCredentialStore } from '../../../identity/index.js';

export class StoredDiscordRecipientResolver implements DiscordRecipientResolverPort {
  constructor(
    private readonly store: SysadminDiscordBotCredentialStore,
    private readonly resolver = new DiscordRecipientResolver(),
  ) {}

  async resolve(server: DiscordServerContext, discordUsername: string | null) {
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
