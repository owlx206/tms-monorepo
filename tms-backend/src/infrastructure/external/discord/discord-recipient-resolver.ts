import { ServiceError } from '../../../shared/errors/service.error.js';
import type {
  DiscordBotCredentialSource,
  DiscordGuildMemberIdentity,
} from './discord-api.service.js';

export type DiscordRecipientResolution = {
  userId: string | null;
  error: string | null;
};

export type DiscordRecipientServer = {
  discord_server_id: string;
  bot_token?: string | null;
};

export type DiscordGuildMemberSearch = (input: {
  guildId: string;
  query: string;
  limit?: number;
  botToken: string;
}) => Promise<DiscordGuildMemberIdentity[]>;

function parseDiscordUserId(discordUsername: string | null): string | null {
  if (typeof discordUsername !== 'string') {
    return null;
  }

  const normalized = discordUsername.trim();
  if (!normalized) {
    return null;
  }

  const mentionMatch = /^<@!?(\d{15,25})>$/.exec(normalized);
  if (mentionMatch) {
    return mentionMatch[1];
  }

  if (/^\d{15,25}$/.test(normalized)) {
    return normalized;
  }

  return null;
}

function normalizeDiscordName(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

function normalizeComparableDiscordName(value: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeDiscordName(value);
  if (!normalized) {
    return null;
  }

  return normalized.replace(/\s+/g, ' ');
}

function parseUsernameWithDiscriminator(value: string): { username: string; discriminator: string } | null {
  const match = /^(.+?)#(\d{4})$/.exec(value.trim().replace(/^@/, ''));
  if (!match) {
    return null;
  }

  return {
    username: match[1].trim().toLowerCase(),
    discriminator: match[2],
  };
}

function pickMemberByUsername(
  members: DiscordGuildMemberIdentity[],
  discordUsername: string,
): DiscordRecipientResolution {
  const normalized = normalizeDiscordName(discordUsername);
  const comparable = normalizeComparableDiscordName(discordUsername);
  const withDiscriminator = parseUsernameWithDiscriminator(discordUsername);

  if (withDiscriminator) {
    const exactByTag = members.filter((member) => (
      member.username?.toLowerCase() === withDiscriminator.username
      && member.discriminator === withDiscriminator.discriminator
    ));

    if (exactByTag.length === 1) {
      return { userId: exactByTag[0].user_id, error: null };
    }

    if (exactByTag.length > 1) {
      return { userId: null, error: 'discord_username is ambiguous in this server' };
    }
  }

  const exactMatches = members.filter((member) => (
    normalizeComparableDiscordName(member.username) === comparable
    || normalizeComparableDiscordName(member.global_name) === comparable
    || normalizeComparableDiscordName(member.nick) === comparable
  ));

  if (exactMatches.length === 1) {
    return { userId: exactMatches[0].user_id, error: null };
  }

  if (exactMatches.length > 1) {
    return { userId: null, error: 'discord_username is ambiguous in this server' };
  }

  if (members.length === 1) {
    return { userId: members[0].user_id, error: null };
  }

  return { userId: null, error: `discord_username "${normalized}" not found in this server` };
}

function toFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof ServiceError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export class DiscordRecipientResolver {
  private readonly cache = new Map<string, DiscordRecipientResolution>();

  constructor(
    private readonly searchGuildMembers: DiscordGuildMemberSearch,
    private readonly credentialSource?: DiscordBotCredentialSource,
  ) {}

  private async getBotToken(server: DiscordRecipientServer): Promise<string | null> {
    const serverToken = server.bot_token?.trim();
    if (serverToken) {
      return serverToken;
    }

    const credential = await this.credentialSource?.findDefault();
    return credential?.bot_token?.trim() || null;
  }

  async resolve(server: DiscordRecipientServer, discordUsername: string | null): Promise<DiscordRecipientResolution> {
    const rawDiscordUsername = discordUsername?.trim() ?? '';
    if (!rawDiscordUsername) {
      return {
        userId: null,
        error: 'discord_username is required',
      };
    }

    const directUserId = parseDiscordUserId(rawDiscordUsername);
    if (directUserId) {
      return { userId: directUserId, error: null };
    }

    const normalizedLookupKey = `${server.discord_server_id}:${normalizeDiscordName(rawDiscordUsername)}`;
    const cached = this.cache.get(normalizedLookupKey);
    if (cached) {
      return cached;
    }

    const botToken = await this.getBotToken(server);
    if (!botToken) {
      const result = {
        userId: null,
        error: 'bot_token is missing for this class server',
      };
      this.cache.set(normalizedLookupKey, result);
      return result;
    }

    const tag = parseUsernameWithDiscriminator(rawDiscordUsername);
    const query = tag ? tag.username : rawDiscordUsername.trim().replace(/^@/, '');
    let members: DiscordGuildMemberIdentity[];
    try {
      members = await this.searchGuildMembers({
        guildId: server.discord_server_id,
        query,
        limit: 25,
        botToken,
      });
    } catch (error) {
      const result = {
        userId: null,
        error: toFailureMessage(error, 'failed to resolve discord_username'),
      };
      this.cache.set(normalizedLookupKey, result);
      return result;
    }

    const resolved = pickMemberByUsername(members, rawDiscordUsername);
    this.cache.set(normalizedLookupKey, resolved);
    return resolved;
  }
}
