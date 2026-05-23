import { Client, DiscordAPIError, GatewayIntentBits, HTTPError, REST, type VoiceState } from 'discord.js';

import { HttpError } from '../../../shared/errors/HttpError.js';

type DiscordApiErrorPayload = {
  message?: string;
  error_description?: string;
};

type DiscordGuildPayload = {
  id?: string;
  name?: string;
};

type DiscordChannelPayload = {
  id?: string;
  guild_id?: string | null;
  name?: string;
  type?: number;
};

type DiscordUserPayload = {
  id?: string;
  username?: string;
  global_name?: string | null;
  discriminator?: string;
};

type DiscordGuildMemberPayload = {
  user?: DiscordUserPayload | null;
  nick?: string | null;
};

type DiscordMessagePayload = {
  id?: string;
  channel_id?: string;
};

type DiscordInvitePayload = {
  guild?: DiscordGuildPayload | null;
};

type DiscordGuildListItemPayload = {
  id?: string;
  name?: string;
};

type DiscordRequestMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
type DiscordRoute = `/${string}`;
type DiscordRequestOptions = Parameters<REST['get']>[1] & {
  body?: unknown;
};

export type DiscordTokenPayload = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
};

export type DiscordGuildMemberIdentity = {
  user_id: string;
  username: string | null;
  global_name: string | null;
  discriminator: string | null;
  nick: string | null;
};

export type DiscordRecipientResolution = {
  userId: string | null;
  error: string | null;
};

export type DiscordRecipientGuild = {
  discord_guild_id: string;
};

export type DiscordGuildMemberSearch = (input: {
  guildId: string;
  query: string;
  limit?: number;
  botToken: string;
}) => Promise<DiscordGuildMemberIdentity[]>;

export type DiscordBotCredentialSource = {
  findDefault(): Promise<{ bot_token: string | null } | null>;
};

export type DiscordGuildMetadata = {
  id: string;
  name: string;
};

export type DiscordGuildChannel = {
  id: string;
  name: string;
  type: 'text' | 'voice';
};

export type DiscordSentChannelMessage = {
  messageId: string;
  channelId: string;
};

export type DiscordSentDirectMessage = {
  dmChannelId: string;
  messageId: string;
};

const discordRestByBotToken = new Map<string, REST>();
const discordBearerRestByAccessToken = new Map<string, REST>();
const discordUnauthenticatedRest = new REST({ version: '10' });

function normalizeRequiredString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new HttpError(`${fieldName} is required`, 400);
  }

  return normalized;
}

function isDiscordSnowflake(value: string): boolean {
  return /^\d{15,25}$/.test(value);
}

function extractSnowflakeFromText(value: string): string | null {
  return /\d{15,25}/.exec(value)?.[0] ?? null;
}

function parseDiscordUrlPath(value: string): string[] | null {
  try {
    const parsed = new URL(value);
    if (!/^(?:www\.)?(?:canary\.|ptb\.)?discord(?:app)?\.com$/i.test(parsed.hostname)) {
      return null;
    }

    return parsed.pathname.split('/').filter((segment) => segment.length > 0);
  } catch {
    return null;
  }
}

function extractGuildIdCandidate(input: string): string {
  const normalized = input.trim();
  if (isDiscordSnowflake(normalized)) {
    return normalized;
  }

  const textCandidate = extractSnowflakeFromText(normalized);
  if (textCandidate) {
    return textCandidate;
  }

  const pathSegments = parseDiscordUrlPath(normalized);
  if (!pathSegments || pathSegments.length < 2) {
    return normalized;
  }

  if ((pathSegments[0] === 'channels' || pathSegments[0] === 'guilds') && isDiscordSnowflake(pathSegments[1])) {
    return pathSegments[1];
  }

  return normalized;
}

function extractChannelIdCandidate(input: string): string | null {
  const normalized = input.trim();
  if (isDiscordSnowflake(normalized)) {
    return normalized;
  }

  const textCandidates = normalized.match(/\d{15,25}/g);
  if (textCandidates?.length) {
    return textCandidates[textCandidates.length - 1] ?? null;
  }

  const pathSegments = parseDiscordUrlPath(normalized);
  if (!pathSegments || pathSegments.length < 3) {
    return null;
  }

  return pathSegments[0] === 'channels' && isDiscordSnowflake(pathSegments[2] ?? '')
    ? pathSegments[2] ?? null
    : null;
}

function extractDiscordInviteCode(input: string): string | null {
  const normalized = input.trim();
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);

    if ((hostname === 'discord.gg' || hostname === 'www.discord.gg') && segments[0]) {
      return segments[0];
    }

    if (/^(?:www\.)?(?:canary\.|ptb\.)?discord(?:app)?\.com$/i.test(hostname)
      && segments[0] === 'invite'
      && segments[1]) {
      return segments[1];
    }

    return null;
  } catch {
    return null;
  }
}

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
      return { userId: null, error: 'discord_username is ambiguous in this guild' };
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
    return { userId: null, error: 'discord_username is ambiguous in this guild' };
  }

  if (members.length === 1) {
    return { userId: members[0].user_id, error: null };
  }

  return { userId: null, error: `discord_username "${normalized}" not found in this guild` };
}

function toDiscordRecipientFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function extractGuildPayload(payload: unknown): DiscordGuildMetadata | null {
  const guild = payload as DiscordGuildPayload | null;
  if (!guild || typeof guild.id !== 'string' || typeof guild.name !== 'string' || guild.name.trim().length === 0) {
    return null;
  }

  return {
    id: guild.id,
    name: guild.name.trim(),
  };
}

function parseDiscordErrorMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const errorPayload = payload as DiscordApiErrorPayload;
  return errorPayload.message?.trim() || errorPayload.error_description?.trim() || null;
}

function getDiscordErrorStatus(error: unknown): number | null {
  return error instanceof DiscordAPIError || error instanceof HTTPError ? error.status : null;
}

function getDiscordErrorMessage(error: unknown): string | null {
  if (error instanceof DiscordAPIError) {
    return parseDiscordErrorMessage(error.rawError) ?? error.message;
  }

  if (error instanceof HTTPError) {
    return error.message;
  }

  return error instanceof Error ? error.message : null;
}

function toDiscordHttpError(error: unknown, fallbackMessage: string, statusCode = 502): HttpError {
  const status = getDiscordErrorStatus(error);
  const detail = getDiscordErrorMessage(error);
  const message = detail ? `${fallbackMessage}: ${detail}` : fallbackMessage;

  return new HttpError(message, status === 401 || status === 403 ? 400 : statusCode);
}

function toGuildMemberIdentity(item: unknown): DiscordGuildMemberIdentity | null {
  if (typeof item !== 'object' || item === null) {
    return null;
  }

  const member = item as DiscordGuildMemberPayload;
  if (!member.user?.id) {
    return null;
  }

  return {
    user_id: member.user.id,
    username: member.user.username?.trim() || null,
    global_name: member.user.global_name?.trim() || null,
    discriminator: member.user.discriminator?.trim() || null,
    nick: member.nick?.trim() || null,
  };
}

function identityFromVoiceState(voiceState: VoiceState): DiscordGuildMemberIdentity | null {
  const user = voiceState.member?.user;
  if (!user) {
    return null;
  }

  return {
    user_id: user.id,
    username: user.username,
    global_name: user.globalName,
    discriminator: user.discriminator,
    nick: voiceState.member?.nickname ?? null,
  };
}

export function getDiscordBotRest(botToken: string): REST {
  const normalizedBotToken = normalizeRequiredString(botToken, 'bot_token');
  const existing = discordRestByBotToken.get(normalizedBotToken);
  if (existing) {
    return existing;
  }

  const rest = new REST({ version: '10' }).setToken(normalizedBotToken);
  discordRestByBotToken.set(normalizedBotToken, rest);
  return rest;
}

function getDiscordBearerRest(accessToken: string): REST {
  const normalizedAccessToken = normalizeRequiredString(accessToken, 'access_token');
  const existing = discordBearerRestByAccessToken.get(normalizedAccessToken);
  if (existing) {
    return existing;
  }

  const rest = new REST({ version: '10', authPrefix: 'Bearer' }).setToken(normalizedAccessToken);
  discordBearerRestByAccessToken.set(normalizedAccessToken, rest);
  return rest;
}

export class DiscordClient {
  private readonly rest: REST;

  constructor(botToken: string) {
    this.rest = getDiscordBotRest(botToken);
  }

  request<T>(method: DiscordRequestMethod, route: DiscordRoute, options?: DiscordRequestOptions): Promise<T> {
    switch (method) {
      case 'get':
        return this.rest.get(route, options) as Promise<T>;
      case 'post':
        return this.rest.post(route, options) as Promise<T>;
      case 'put':
        return this.rest.put(route, options) as Promise<T>;
      case 'patch':
        return this.rest.patch(route, options) as Promise<T>;
      case 'delete':
        return this.rest.delete(route, options) as Promise<T>;
    }
  }
}

export class DiscordGuild {
  constructor(private readonly client: DiscordClient) {}

  async list(): Promise<DiscordGuildMetadata[]> {
    let payload: unknown;
    try {
      payload = await this.client.request('get', '/users/@me/guilds');
    } catch (error) {
      const status = getDiscordErrorStatus(error);
      if (status === 401 || status === 403) {
        throw new HttpError('invalid bot_token or bot cannot list guilds', 400);
      }

      throw toDiscordHttpError(error, 'failed to list Discord guilds');
    }

    if (!Array.isArray(payload)) {
      throw new HttpError('discord guild list response is invalid', 502);
    }

    return payload
      .map((item) => {
        const guild = item as DiscordGuildListItemPayload | null;
        return guild?.id && guild.name ? { id: guild.id, name: guild.name.trim() } : null;
      })
      .filter((item): item is DiscordGuildMetadata => item !== null);
  }

  async checkBotTokenHealth(): Promise<{ healthy: boolean; message: string }> {
    try {
      const payload = await this.client.request<unknown>('get', '/users/@me');
      const user = payload as DiscordUserPayload | null;
      if (!user?.id) {
        return { healthy: false, message: 'Discord /users/@me response is invalid.' };
      }

      return {
        healthy: true,
        message: user.username ? `Authenticated as ${user.username}.` : 'Bot token is valid.',
      };
    } catch (error) {
      const status = getDiscordErrorStatus(error);
      if (status === 401 || status === 403) {
        return { healthy: false, message: 'Bot token is invalid or rejected by Discord.' };
      }

      const detail = getDiscordErrorMessage(error);
      return {
        healthy: false,
        message: detail ? `Discord API error: ${detail}` : 'Discord API error.',
      };
    }
  }

  async fetchMetadata(guildIdOrUrl: string): Promise<DiscordGuildMetadata> {
    const rawGuildId = normalizeRequiredString(guildIdOrUrl, 'discord_guild_id');
    const inviteCode = extractDiscordInviteCode(rawGuildId);
    let guildIdCandidate = extractGuildIdCandidate(rawGuildId);
    if (!isDiscordSnowflake(guildIdCandidate) && inviteCode) {
      const guildFromInvite = await this.fetchFromInviteCode(inviteCode);
      if (guildFromInvite) {
        guildIdCandidate = guildFromInvite.id;
      }
    }

    if (!isDiscordSnowflake(guildIdCandidate)) {
      throw new HttpError('discord_guild_id must be a valid Discord Guild ID or Discord guild URL', 400);
    }

    try {
      const guild = extractGuildPayload(await this.client.request<unknown>(
        'get',
        `/guilds/${encodeURIComponent(guildIdCandidate)}`,
      ));
      if (!guild) {
        throw new HttpError('discord guild metadata is invalid', 502);
      }

      return guild;
    } catch (error) {
      const status = getDiscordErrorStatus(error);
      if (status === 401 || status === 403) {
        throw new HttpError('invalid bot_token or bot has no access to this guild', 400);
      }
      if (status !== 404) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw toDiscordHttpError(error, 'failed to sync discord guild metadata');
      }

      const channelIdCandidate = extractChannelIdCandidate(rawGuildId);
      if (channelIdCandidate) {
        try {
          const channel = await this.fetchChannelMetadata(channelIdCandidate);
          if (channel.guild_id) {
            const guild = extractGuildPayload(await this.client.request<unknown>(
              'get',
              `/guilds/${encodeURIComponent(channel.guild_id)}`,
            ));
            if (guild) {
              return guild;
            }
          }
        } catch (channelError) {
          if (channelError instanceof HttpError && channelError.statusCode !== 404) {
            throw channelError;
          }
        }
      }

      throw new HttpError(
        'discord guild not found or bot is not in this guild (hãy dùng đúng Guild ID và đảm bảo bot đã được mời vào guild)',
        404,
      );
    }
  }

  async listChannels(guildId: string): Promise<DiscordGuildChannel[]> {
    const normalizedGuildId = normalizeRequiredString(guildId, 'guild_id');
    let payload: unknown;
    try {
      payload = await this.client.request('get', `/guilds/${encodeURIComponent(normalizedGuildId)}/channels`);
    } catch (error) {
      const status = getDiscordErrorStatus(error);
      if (status === 401 || status === 403) {
        throw new HttpError('invalid bot_token or bot cannot list guild channels', 400);
      }
      if (status === 404) {
        throw new HttpError('discord guild not found or bot is not in this guild', 404);
      }

      throw toDiscordHttpError(error, 'failed to list Discord guild channels');
    }

    if (!Array.isArray(payload)) {
      throw new HttpError('discord guild channel list response is invalid', 502);
    }

    return payload
      .map((item) => {
        const channel = item as DiscordChannelPayload | null;
        if (!channel?.id || !channel.name) {
          return null;
        }

        const type = channel.type === 2 ? 'voice' : channel.type === 0 ? 'text' : null;
        return type ? { id: channel.id, name: channel.name.trim(), type } : null;
      })
      .filter((item): item is DiscordGuildChannel => item !== null);
  }

  async fetchChannelMetadata(channelId: string): Promise<{ id: string; guild_id: string | null; name: string | null }> {
    const normalizedChannelId = normalizeRequiredString(channelId, 'channel_id');
    let payload: unknown;
    try {
      payload = await this.client.request('get', `/channels/${encodeURIComponent(normalizedChannelId)}`);
    } catch (error) {
      const status = getDiscordErrorStatus(error);
      if (status === 401 || status === 403) {
        throw new HttpError('invalid bot_token or bot has no access to this channel', 400);
      }
      if (status === 404) {
        throw new HttpError('discord channel not found', 404);
      }

      throw toDiscordHttpError(error, 'failed to fetch discord channel metadata');
    }

    const channel = payload as DiscordChannelPayload | null;
    if (!channel?.id) {
      throw new HttpError('discord channel metadata is invalid', 502);
    }

    return {
      id: channel.id,
      guild_id: typeof channel.guild_id === 'string' ? channel.guild_id : null,
      name: channel.name?.trim() || null,
    };
  }

  async ensureChannelBelongsToGuild(input: {
    channelId: string;
    guildId: string;
    fieldName: string;
  }): Promise<void> {
    const channel = await this.fetchChannelMetadata(input.channelId);
    if (channel.guild_id !== input.guildId) {
      throw new HttpError(`${input.fieldName} does not belong to discord_guild_id`, 400);
    }
  }

  async createInvite(channelId: string, maxAge?: number, maxUses?: number): Promise<{ code: string; url: string }> {
    let payload: unknown;
    try {
      payload = await this.client.request('post', `/channels/${encodeURIComponent(channelId)}/invites`, {
        body: {
          max_age: maxAge ?? 86400,
          max_uses: maxUses ?? 1,
          unique: true,
        },
      });
    } catch (error) {
      throw toDiscordHttpError(error, 'failed to create invite');
    }

    const invite = payload as { code?: string } | null;
    if (!invite?.code) {
      throw new HttpError('discord invite response is invalid', 502);
    }

    return { code: invite.code, url: `https://discord.gg/${invite.code}` };
  }

  private async fetchFromInviteCode(inviteCode: string): Promise<DiscordGuildMetadata | null> {
    const normalizedInviteCode = inviteCode.trim();
    if (!normalizedInviteCode) {
      return null;
    }

    try {
      const payload = await this.client.request<unknown>('get', `/invites/${encodeURIComponent(normalizedInviteCode)}`, {
        query: new URLSearchParams({
          with_counts: 'false',
          with_expiration: 'false',
        }),
      });
      const invite = payload as DiscordInvitePayload | null;
      return extractGuildPayload(invite?.guild ?? null);
    } catch (error) {
      const status = getDiscordErrorStatus(error);
      if (status === 404) {
        return null;
      }
      if (status === 401 || status === 403) {
        throw new HttpError('invalid bot_token or bot has no access to this invite', 400);
      }

      throw toDiscordHttpError(error, 'failed to resolve discord invite');
    }
  }
}

export class DiscordMember {
  constructor(private readonly client: DiscordClient) {}

  async search(guildId: string, query: string, limit?: number): Promise<DiscordGuildMemberIdentity[]> {
    const normalizedGuildId = normalizeRequiredString(guildId, 'guild_id');
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      throw new HttpError('query is required', 400);
    }

    const normalizedLimit = Number.isInteger(limit) && (limit ?? 0) > 0 ? Math.min(limit ?? 25, 100) : 25;
    let payload: unknown;
    try {
      payload = await this.client.request('get', `/guilds/${encodeURIComponent(normalizedGuildId)}/members/search`, {
        query: new URLSearchParams({
          query: normalizedQuery,
          limit: String(normalizedLimit),
        }),
      });
    } catch (error) {
      const status = getDiscordErrorStatus(error);
      if (status === 401 || status === 403) {
        throw new HttpError('invalid bot_token or bot has no access to search guild members', 400);
      }
      if (status === 404) {
        throw new HttpError('discord guild not found or bot is not in this guild', 404);
      }
      if (status === 429) {
        throw new HttpError('discord rate limit exceeded, please retry later', 429);
      }

      throw toDiscordHttpError(error, 'failed to search Discord guild members');
    }

    if (!Array.isArray(payload)) {
      throw new HttpError('discord guild member search response is invalid', 502);
    }

    return payload
      .map((item) => toGuildMemberIdentity(item))
      .filter((item): item is DiscordGuildMemberIdentity => item !== null);
  }

  async fetch(guildId: string, userId: string): Promise<DiscordGuildMemberIdentity | null> {
    const normalizedGuildId = normalizeRequiredString(guildId, 'guild_id');
    const normalizedUserId = normalizeRequiredString(userId, 'user_id');

    let payload: unknown;
    try {
      payload = await this.client.request(
        'get',
        `/guilds/${encodeURIComponent(normalizedGuildId)}/members/${encodeURIComponent(normalizedUserId)}`,
      );
    } catch (error) {
      const status = getDiscordErrorStatus(error);
      if (status === 404) {
        return null;
      }
      if (status === 401 || status === 403) {
        throw new HttpError('invalid bot_token or bot has no access to fetch guild member', 400);
      }
      if (status === 429) {
        throw new HttpError('discord rate limit exceeded, please retry later', 429);
      }

      throw toDiscordHttpError(error, 'failed to fetch Discord guild member');
    }

    const identity = toGuildMemberIdentity(payload);
    if (!identity) {
      throw new HttpError('discord guild member response is invalid', 502);
    }

    return identity;
  }

  async kick(guildId: string, userId: string): Promise<void> {
    try {
      await this.client.request(
        'delete',
        `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`,
      );
    } catch (error) {
      if (getDiscordErrorStatus(error) === 404) {
        return;
      }

      throw toDiscordHttpError(error, 'failed to kick member');
    }
  }

  async add(guildId: string, userId: string, userAccessToken: string): Promise<void> {
    try {
      await this.client.request(
        'put',
        `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`,
        {
          body: {
            access_token: normalizeRequiredString(userAccessToken, 'user_access_token'),
          },
        },
      );
    } catch (error) {
      throw toDiscordHttpError(error, 'failed to add guild member');
    }
  }
}

export class DiscordRecipientResolver {
  private readonly cache = new Map<string, DiscordRecipientResolution>();

  constructor(private readonly searchGuildMembers: DiscordGuildMemberSearch) {}

  async resolve(input: {
    botToken: string;
    guild: DiscordRecipientGuild;
    discordUsername: string | null;
  }): Promise<DiscordRecipientResolution> {
    const rawDiscordUsername = input.discordUsername?.trim() ?? '';
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

    const normalizedLookupKey = `${input.botToken}:${input.guild.discord_guild_id}:${normalizeDiscordName(rawDiscordUsername)}`;
    const cached = this.cache.get(normalizedLookupKey);
    if (cached) {
      return cached;
    }

    const tag = parseUsernameWithDiscriminator(rawDiscordUsername);
    const query = tag ? tag.username : rawDiscordUsername.trim().replace(/^@/, '');
    let members: DiscordGuildMemberIdentity[];
    try {
      members = await this.searchGuildMembers({
        guildId: input.guild.discord_guild_id,
        query,
        limit: 25,
        botToken: input.botToken,
      });
    } catch (error) {
      const result = {
        userId: null,
        error: toDiscordRecipientFailureMessage(error, 'failed to resolve discord_username'),
      };
      this.cache.set(normalizedLookupKey, result);
      return result;
    }

    const resolved = pickMemberByUsername(members, rawDiscordUsername);
    this.cache.set(normalizedLookupKey, resolved);
    return resolved;
  }
}

export class DiscordMessenger {
  constructor(private readonly client: DiscordClient) {}

  async sendChannelMessage(channelId: string, content: string): Promise<DiscordSentChannelMessage> {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      throw new HttpError('content is required', 400);
    }

    if (normalizedContent.length > 2000) {
      throw new HttpError('content must be 2000 characters or less', 400);
    }

    const normalizedChannelId = normalizeRequiredString(channelId, 'channel_id');
    let payload: unknown;
    try {
      payload = await this.client.request('post', `/channels/${encodeURIComponent(normalizedChannelId)}/messages`, {
        body: { content: normalizedContent },
      });
    } catch (error) {
      const status = getDiscordErrorStatus(error);
      if (status === 401 || status === 403) {
        throw new HttpError('invalid bot_token or bot cannot send message to this channel', 400);
      }
      if (status === 404) {
        throw new HttpError('discord channel not found', 404);
      }
      if (status === 429) {
        throw new HttpError('discord rate limit exceeded, please retry later', 429);
      }

      throw toDiscordHttpError(error, 'failed to send message to Discord channel');
    }

    const message = payload as DiscordMessagePayload | null;
    if (!message?.id || !message.channel_id) {
      throw new HttpError('discord message response is invalid', 502);
    }

    return { messageId: message.id, channelId: message.channel_id };
  }

  async sendDirectMessage(recipientUserId: string, content: string): Promise<DiscordSentDirectMessage> {
    const dmChannelId = await this.createDmChannel(recipientUserId);
    const sent = await this.sendChannelMessage(dmChannelId, content);

    return { dmChannelId, messageId: sent.messageId };
  }

  private async createDmChannel(recipientUserId: string): Promise<string> {
    const normalizedUserId = normalizeRequiredString(recipientUserId, 'recipient_user_id');
    let payload: unknown;
    try {
      payload = await this.client.request('post', '/users/@me/channels', {
        body: { recipient_id: normalizedUserId },
      });
    } catch (error) {
      const status = getDiscordErrorStatus(error);
      if (status === 401 || status === 403) {
        throw new HttpError('invalid bot_token or bot cannot start DM with this user', 400);
      }
      if (status === 404 || status === 400) {
        throw new HttpError('discord user not found or bot cannot open DM', 400);
      }
      if (status === 429) {
        throw new HttpError('discord rate limit exceeded, please retry later', 429);
      }

      throw toDiscordHttpError(error, 'failed to create Discord DM channel');
    }

    const channel = payload as DiscordChannelPayload | null;
    if (!channel?.id) {
      throw new HttpError('discord DM channel response is invalid', 502);
    }

    return channel.id;
  }
}

type DiscordVoiceClientState = {
  client: Client;
  tokenKey: string;
  ready: boolean;
};

export class DiscordVoice {
  private static readonly clientByToken = new Map<string, DiscordVoiceClientState>();
  private readonly state: DiscordVoiceClientState;

  constructor(botToken: string) {
    this.state = DiscordVoice.ensureClient(botToken);
  }

  async listVoiceChannelMembers(
    guildId: string,
    channelId: string,
    options?: { timeoutMs?: number },
  ): Promise<DiscordGuildMemberIdentity[]> {
    await this.waitForReady(options?.timeoutMs ?? 15_000);

    const guild = this.state.client.guilds.cache.get(guildId)
      ?? await this.state.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      return [];
    }

    const voiceStates = guild.voiceStates.cache.filter((voiceState) => voiceState.channelId === channelId);
    const identities: DiscordGuildMemberIdentity[] = [];

    for (const voiceState of voiceStates.values()) {
      const cachedIdentity = identityFromVoiceState(voiceState);
      if (cachedIdentity) {
        identities.push(cachedIdentity);
        continue;
      }

      const userId = voiceState.id;
      const member = await guild.members.fetch(userId).catch(() => null);
      identities.push({
        user_id: member?.user.id ?? userId,
        username: member?.user.username ?? null,
        global_name: member?.user.globalName ?? null,
        discriminator: member?.user.discriminator ?? null,
        nick: member?.nickname ?? null,
      });
    }

    return identities;
  }

  static destroyAll(): void {
    DiscordVoice.clientByToken.forEach((state) => {
      state.client.destroy();
    });
    DiscordVoice.clientByToken.clear();
  }

  private static ensureClient(botToken: string): DiscordVoiceClientState {
    const normalizedBotToken = normalizeRequiredString(botToken, 'bot_token');
    const existing = DiscordVoice.clientByToken.get(normalizedBotToken);
    if (existing) {
      return existing;
    }

    const state: DiscordVoiceClientState = {
      client: new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
      }),
      tokenKey: normalizedBotToken.slice(-12),
      ready: false,
    };

    state.client.once('ready', () => {
      state.ready = true;
      console.log(`[discord-voice] bot connected (${state.tokenKey})`);
    });

    state.client.on('error', (error) => {
      console.warn(`[discord-voice] client error (${state.tokenKey})`, error);
    });

    void state.client.login(normalizedBotToken).catch((error: unknown) => {
      console.warn(`[discord-voice] failed to login bot (${state.tokenKey})`, error);
      state.client.destroy();
      DiscordVoice.clientByToken.delete(normalizedBotToken);
    });

    DiscordVoice.clientByToken.set(normalizedBotToken, state);
    return state;
  }

  private waitForReady(timeoutMs: number): Promise<void> {
    if (this.state.ready) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new HttpError('discord bot connection timed out', 504));
      }, timeoutMs);

      const handleReady = () => {
        cleanup();
        resolve();
      };

      const handleError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.state.client.off('ready', handleReady);
        this.state.client.off('error', handleError);
      };

      this.state.client.once('ready', handleReady);
      this.state.client.once('error', handleError);
    });
  }
}

export class DiscordOAuth {
  static async exchangeCode(input: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }): Promise<DiscordTokenPayload> {
    try {
      const payload = await discordUnauthenticatedRest.post('/oauth2/token', {
        auth: false,
        passThroughBody: true,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: input.clientId,
          client_secret: input.clientSecret,
          grant_type: 'authorization_code',
          code: input.code,
          redirect_uri: input.redirectUri,
        }),
      });

      return payload as DiscordTokenPayload;
    } catch (error) {
      throw toDiscordHttpError(error, 'failed to complete Discord authorization');
    }
  }

  static async refreshToken(input: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }): Promise<DiscordTokenPayload> {
    try {
      const payload = await discordUnauthenticatedRest.post('/oauth2/token', {
        auth: false,
        passThroughBody: true,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: input.clientId,
          client_secret: input.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: input.refreshToken,
        }),
      });

      return payload as DiscordTokenPayload;
    } catch (error) {
      throw toDiscordHttpError(error, 'failed to refresh Discord authorization', 401);
    }
  }

  static async fetchCurrentUser(accessToken: string): Promise<{ id: string; username: string }> {
    let payload: unknown;
    try {
      payload = await getDiscordBearerRest(accessToken).get('/users/@me', { authPrefix: 'Bearer' });
    } catch (error) {
      throw toDiscordHttpError(error, 'failed to fetch Discord user profile');
    }

    const user = payload as DiscordUserPayload | null;
    if (!user?.id || !user.username) {
      throw new HttpError('invalid Discord user profile response', 502);
    }

    return { id: user.id, username: user.username };
  }
}

export async function resolveDiscordBotToken(
  credentialSource: DiscordBotCredentialSource,
  botToken?: string | null,
): Promise<string> {
  const provided = botToken?.trim();
  if (provided) {
    return provided;
  }

  const credential = await credentialSource.findDefault();
  const stored = credential?.bot_token?.trim();
  if (!stored) {
    throw new HttpError('discord is not available right now', 503);
  }

  return stored;
}

export async function listDiscordGuilds(botToken: string): Promise<DiscordGuildMetadata[]> {
  return new DiscordGuild(new DiscordClient(botToken)).list();
}

export async function checkDiscordBotTokenHealth(botToken: string): Promise<{ healthy: boolean; message: string }> {
  return new DiscordGuild(new DiscordClient(botToken)).checkBotTokenHealth();
}

export async function fetchDiscordGuildMetadata(
  botToken: string,
  discordGuildId: string,
): Promise<DiscordGuildMetadata> {
  return new DiscordGuild(new DiscordClient(botToken)).fetchMetadata(discordGuildId);
}

export async function listDiscordGuildChannels(botToken: string, guildId: string): Promise<DiscordGuildChannel[]> {
  return new DiscordGuild(new DiscordClient(botToken)).listChannels(guildId);
}

export async function fetchDiscordChannelMetadata(botToken: string, channelId: string): Promise<{
  id: string;
  guild_id: string | null;
  name: string | null;
}> {
  return new DiscordGuild(new DiscordClient(botToken)).fetchChannelMetadata(channelId);
}

export async function ensureDiscordChannelBelongsToGuild(input: {
  botToken: string;
  channelId: string;
  guildId: string;
  fieldName: string;
}): Promise<void> {
  return new DiscordGuild(new DiscordClient(input.botToken)).ensureChannelBelongsToGuild(input);
}

export async function searchDiscordGuildMembers(input: {
  botToken: string;
  guildId: string;
  query: string;
  limit?: number;
}): Promise<DiscordGuildMemberIdentity[]> {
  return new DiscordMember(new DiscordClient(input.botToken)).search(input.guildId, input.query, input.limit);
}

export async function fetchDiscordGuildMember(input: {
  botToken: string;
  guildId: string;
  userId: string;
}): Promise<DiscordGuildMemberIdentity | null> {
  return new DiscordMember(new DiscordClient(input.botToken)).fetch(input.guildId, input.userId);
}

export async function postDiscordChannelMessage(input: {
  botToken: string;
  channelId: string;
  content: string;
}): Promise<DiscordSentChannelMessage> {
  return new DiscordMessenger(new DiscordClient(input.botToken)).sendChannelMessage(input.channelId, input.content);
}

export async function sendDiscordDirectMessage(input: {
  botToken: string;
  recipientUserId: string;
  content: string;
}): Promise<DiscordSentDirectMessage> {
  return new DiscordMessenger(new DiscordClient(input.botToken)).sendDirectMessage(input.recipientUserId, input.content);
}

export async function kickDiscordGuildMember(input: {
  botToken: string;
  guildId: string;
  userId: string;
}): Promise<void> {
  return new DiscordMember(new DiscordClient(input.botToken)).kick(input.guildId, input.userId);
}

export async function addDiscordGuildMember(input: {
  botToken: string;
  guildId: string;
  userId: string;
  userAccessToken: string;
}): Promise<void> {
  return new DiscordMember(new DiscordClient(input.botToken)).add(input.guildId, input.userId, input.userAccessToken);
}

export async function createDiscordGuildInvite(input: {
  botToken: string;
  channelId: string;
  maxAge?: number;
  maxUses?: number;
}): Promise<{ code: string; url: string }> {
  return new DiscordGuild(new DiscordClient(input.botToken)).createInvite(input.channelId, input.maxAge, input.maxUses);
}

export async function exchangeDiscordOAuthCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<DiscordTokenPayload> {
  return DiscordOAuth.exchangeCode(input);
}

export async function refreshDiscordOAuthToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<DiscordTokenPayload> {
  return DiscordOAuth.refreshToken(input);
}

export async function fetchDiscordCurrentUser(accessToken: string): Promise<{ id: string; username: string }> {
  return DiscordOAuth.fetchCurrentUser(accessToken);
}
