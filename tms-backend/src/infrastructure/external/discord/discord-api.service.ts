import { DiscordAPIError, HTTPError, REST } from 'discord.js';

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

type DiscordApiResponse = {
  status: number;
  ok: boolean;
  payload: unknown;
};

const discordRestByBotToken = new Map<string, REST>();

function isDiscordSnowflake(value: string): boolean {
  return /^\d{15,25}$/.test(value);
}

function extractSnowflakeFromText(value: string): string | null {
  const match = /\d{15,25}/.exec(value);
  return match ? match[0] : null;
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

  if (pathSegments[0] === 'channels' && isDiscordSnowflake(pathSegments[1])) {
    return pathSegments[1];
  }

  if (pathSegments[0] === 'guilds' && isDiscordSnowflake(pathSegments[1])) {
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
  if (textCandidates && textCandidates.length > 0) {
    return textCandidates[textCandidates.length - 1];
  }

  const pathSegments = parseDiscordUrlPath(normalized);
  if (!pathSegments || pathSegments.length < 3) {
    return null;
  }

  if (pathSegments[0] === 'channels' && isDiscordSnowflake(pathSegments[2])) {
    return pathSegments[2];
  }

  return null;
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

    if (/^(?:www\.)?(?:canary\.|ptb\.)?discord(?:app)?\.com$/i.test(hostname)) {
      if (segments[0] === 'invite' && segments[1]) {
        return segments[1];
      }
    }

    return null;
  } catch {
    return null;
  }
}

function extractGuildPayload(payload: unknown): { id: string; name: string } | null {
  const guild = payload as DiscordGuildPayload | null;
  if (!guild || typeof guild.id !== 'string' || typeof guild.name !== 'string' || guild.name.trim().length === 0) {
    return null;
  }

  return {
    id: guild.id,
    name: guild.name.trim(),
  };
}

function normalizeRequiredString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new HttpError(`${fieldName} is required`, 400);
  }

  return normalized;
}

function parseDiscordErrorMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const errorPayload = payload as DiscordApiErrorPayload;
  if (typeof errorPayload.message === 'string' && errorPayload.message.trim().length > 0) {
    return errorPayload.message.trim();
  }

  if (typeof errorPayload.error_description === 'string' && errorPayload.error_description.trim().length > 0) {
    return errorPayload.error_description.trim();
  }

  return null;
}

async function parseJsonSafe(response: DiscordApiResponse): Promise<unknown> {
  return response.payload;
}

async function getDiscordErrorMessage(response: DiscordApiResponse): Promise<string | null> {
  const payload = await parseJsonSafe(response);
  return parseDiscordErrorMessage(payload);
}

function getDiscordRestClient(botToken: string): REST {
  const existing = discordRestByBotToken.get(botToken);
  if (existing) {
    return existing;
  }

  const rest = new REST({ version: '10' }).setToken(botToken);
  discordRestByBotToken.set(botToken, rest);
  return rest;
}

function splitDiscordPath(path: string): {
  route: `/${string}`;
  query: URLSearchParams | undefined;
} {
  const separatorIndex = path.indexOf('?');
  const route = (separatorIndex >= 0 ? path.slice(0, separatorIndex) : path) as `/${string}`;
  const queryString = separatorIndex >= 0 ? path.slice(separatorIndex + 1) : '';

  return {
    route,
    query: queryString ? new URLSearchParams(queryString) : undefined,
  };
}

function successStatusForDiscordRestResponse(method: 'GET' | 'POST' | 'DELETE' | 'PUT', payload: unknown): number {
  if (method === 'DELETE') {
    return 204;
  }

  if (method === 'PUT') {
    return payload === null || payload === undefined ? 204 : 201;
  }

  return 200;
}

async function runDiscordRestRequest(
  rest: REST,
  method: 'GET' | 'POST' | 'DELETE' | 'PUT',
  route: `/${string}`,
  query: URLSearchParams | undefined,
  body: Record<string, unknown> | undefined,
): Promise<unknown> {
  const requestData = {
    ...(query ? { query } : {}),
    ...(body ? { body } : {}),
  };

  switch (method) {
    case 'DELETE':
      return rest.delete(route, requestData);
    case 'POST':
      return rest.post(route, requestData);
    case 'PUT':
      return rest.put(route, requestData);
    default:
      return rest.get(route, requestData);
  }
}

async function discordApiRequest(
  path: string,
  botToken: string,
  options?: {
    method?: 'GET' | 'POST' | 'DELETE' | 'PUT';
    body?: Record<string, unknown>;
  },
): Promise<DiscordApiResponse> {
  const normalizedBotToken = normalizeRequiredString(botToken, 'bot_token');
  const method = options?.method ?? 'GET';
  const { route, query } = splitDiscordPath(path);
  const rest = getDiscordRestClient(normalizedBotToken);

  try {
    const payload = await runDiscordRestRequest(rest, method, route, query, options?.body);
    return {
      status: successStatusForDiscordRestResponse(method, payload),
      ok: true,
      payload,
    };
  } catch (error) {
    if (error instanceof DiscordAPIError) {
      return {
        status: error.status,
        ok: false,
        payload: error.rawError,
      };
    }

    if (error instanceof HTTPError) {
      return {
        status: error.status,
        ok: false,
        payload: { message: error.message },
      };
    }

    if (error instanceof Error) {
      throw new HttpError(error.message || 'failed to connect to Discord API', 502);
    }

    throw new HttpError('failed to connect to Discord API', 502);
  }
}

export type DiscordGuildMemberIdentity = {
  user_id: string;
  username: string | null;
  global_name: string | null;
  discriminator: string | null;
  nick: string | null;
};

export class DiscordClient {
  constructor(private readonly botToken: string) {}

  private request(
    path: string,
    options?: {
      method?: 'GET' | 'POST' | 'DELETE' | 'PUT';
      body?: Record<string, unknown>;
    },
  ): Promise<DiscordApiResponse> {
    return discordApiRequest(path, this.botToken, options);
  }

  private async fetchGuildFromInviteCode(inviteCode: string): Promise<{
    id: string;
    name: string;
  } | null> {
    const normalizedInviteCode = inviteCode.trim();
    if (!normalizedInviteCode) {
      return null;
    }

    const response = await this.request(
      `/invites/${encodeURIComponent(normalizedInviteCode)}?with_counts=false&with_expiration=false`,
    );

    if (response.status === 404) {
      return null;
    }

    if (response.status === 401 || response.status === 403) {
      throw new HttpError('invalid bot_token or bot has no access to this invite', 400);
    }

    if (!response.ok) {
      const detail = await getDiscordErrorMessage(response);
      throw new HttpError(
        detail ? `failed to resolve discord invite: ${detail}` : 'failed to resolve discord invite',
        502,
      );
    }

    const payload = await parseJsonSafe(response) as DiscordInvitePayload | null;
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    return extractGuildPayload(payload.guild ?? null);
  }

  async listGuilds(): Promise<Array<{ id: string; name: string }>> {
    const response = await this.request('/users/@me/guilds');

    if (response.status === 401 || response.status === 403) {
      throw new HttpError('invalid bot_token or bot cannot list guilds', 400);
    }

    if (!response.ok) {
      const detail = await getDiscordErrorMessage(response);
      throw new HttpError(
        detail ? `failed to list Discord guilds: ${detail}` : 'failed to list Discord guilds',
        502,
      );
    }

    const payload = await parseJsonSafe(response);
    if (!Array.isArray(payload)) {
      throw new HttpError('discord guild list response is invalid', 502);
    }

    return payload
      .map((item) => {
        const guild = item as DiscordGuildListItemPayload | null;
        if (!guild || typeof guild.id !== 'string' || typeof guild.name !== 'string') {
          return null;
        }

        return {
          id: guild.id,
          name: guild.name.trim(),
        };
      })
      .filter((item): item is { id: string; name: string } => item !== null);
  }

  async checkBotTokenHealth(): Promise<{ healthy: boolean; message: string }> {
    const response = await this.request('/users/@me');

    if (response.status === 401 || response.status === 403) {
      return {
        healthy: false,
        message: 'Bot token is invalid or rejected by Discord.',
      };
    }

    if (!response.ok) {
      const detail = await getDiscordErrorMessage(response);
      return {
        healthy: false,
        message: detail ? `Discord API error: ${detail}` : `Discord API error HTTP ${response.status}.`,
      };
    }

    const payload = await parseJsonSafe(response) as DiscordUserPayload | null;
    if (!payload?.id) {
      return {
        healthy: false,
        message: 'Discord /users/@me response is invalid.',
      };
    }

    return {
      healthy: true,
      message: payload.username ? `Authenticated as ${payload.username}.` : 'Bot token is valid.',
    };
  }

  async fetchGuildMetadata(discordGuildId: string): Promise<{
    id: string;
    name: string;
  }> {
    const rawGuildId = normalizeRequiredString(discordGuildId, 'discord_guild_id');
    const inviteCode = extractDiscordInviteCode(rawGuildId);
    let guildIdCandidate = extractGuildIdCandidate(rawGuildId);
    if (!isDiscordSnowflake(guildIdCandidate) && inviteCode) {
      const guildFromInvite = await this.fetchGuildFromInviteCode(inviteCode);
      if (guildFromInvite) {
        guildIdCandidate = guildFromInvite.id;
      }
    }

    if (!isDiscordSnowflake(guildIdCandidate)) {
      throw new HttpError(
        'discord_guild_id must be a valid Discord Guild ID or Discord guild URL',
        400,
      );
    }

    const response = await this.request(`/guilds/${encodeURIComponent(guildIdCandidate)}`);

    if (response.status === 401 || response.status === 403) {
      throw new HttpError('invalid bot_token or bot has no access to this guild', 400);
    }

    if (response.status === 404) {
      const channelIdCandidate = extractChannelIdCandidate(rawGuildId);
      if (channelIdCandidate) {
        try {
          const channel = await this.fetchChannelMetadata(channelIdCandidate);
          if (channel.guild_id) {
            const guildResponseFromChannel = await this.request(
              `/guilds/${encodeURIComponent(channel.guild_id)}`,
            );

            if (guildResponseFromChannel.ok) {
              const guildPayload = extractGuildPayload(await parseJsonSafe(guildResponseFromChannel));
              if (guildPayload) {
                return guildPayload;
              }
            }
          }
        } catch (error) {
          if (error instanceof HttpError && error.statusCode !== 404) {
            throw error;
          }
        }
      }

      throw new HttpError(
        'discord guild not found or bot is not in this guild (hãy dùng đúng Guild ID và đảm bảo bot đã được mời vào guild)',
        404,
      );
    }

    if (!response.ok) {
      const detail = await getDiscordErrorMessage(response);
      throw new HttpError(
        detail ? `failed to sync discord guild metadata: ${detail}` : 'failed to sync discord guild metadata',
        502,
      );
    }

    const payload = extractGuildPayload(await parseJsonSafe(response));
    if (!payload) {
      throw new HttpError('discord guild metadata is invalid', 502);
    }

    return payload;
  }

  async listGuildChannels(guildId: string): Promise<Array<{ id: string; name: string; type: 'text' | 'voice' }>> {
    const normalizedGuildId = normalizeRequiredString(guildId, 'guild_id');
    const response = await this.request(`/guilds/${encodeURIComponent(normalizedGuildId)}/channels`);

    if (response.status === 401 || response.status === 403) {
      throw new HttpError('invalid bot_token or bot cannot list guild channels', 400);
    }

    if (response.status === 404) {
      throw new HttpError('discord guild not found or bot is not in this guild', 404);
    }

    if (!response.ok) {
      const detail = await getDiscordErrorMessage(response);
      throw new HttpError(
        detail ? `failed to list Discord guild channels: ${detail}` : 'failed to list Discord guild channels',
        502,
      );
    }

    const payload = await parseJsonSafe(response);
    if (!Array.isArray(payload)) {
      throw new HttpError('discord guild channel list response is invalid', 502);
    }

    return payload
      .map((item) => {
        const channel = item as DiscordChannelPayload | null;
        if (!channel || typeof channel.id !== 'string' || typeof channel.name !== 'string') {
          return null;
        }

        const type = channel.type === 2 ? 'voice' : channel.type === 0 ? 'text' : null;
        if (!type) {
          return null;
        }

        return {
          id: channel.id,
          name: channel.name.trim(),
          type,
        };
      })
      .filter((item): item is { id: string; name: string; type: 'text' | 'voice' } => item !== null);
  }

  async fetchChannelMetadata(channelId: string): Promise<{
    id: string;
    guild_id: string | null;
    name: string | null;
  }> {
    const normalizedChannelId = normalizeRequiredString(channelId, 'channel_id');
    const response = await this.request(`/channels/${encodeURIComponent(normalizedChannelId)}`);

    if (response.status === 401 || response.status === 403) {
      throw new HttpError('invalid bot_token or bot has no access to this channel', 400);
    }

    if (response.status === 404) {
      throw new HttpError('discord channel not found', 404);
    }

    if (!response.ok) {
      const detail = await getDiscordErrorMessage(response);
      throw new HttpError(
        detail ? `failed to fetch discord channel metadata: ${detail}` : 'failed to fetch discord channel metadata',
        502,
      );
    }

    const payload = await parseJsonSafe(response) as DiscordChannelPayload | null;
    if (!payload || typeof payload.id !== 'string') {
      throw new HttpError('discord channel metadata is invalid', 502);
    }

    return {
      id: payload.id,
      guild_id: typeof payload.guild_id === 'string' ? payload.guild_id : null,
      name: typeof payload.name === 'string' && payload.name.trim().length > 0 ? payload.name.trim() : null,
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

  async searchGuildMembers(input: {
    guildId: string;
    query: string;
    limit?: number;
  }): Promise<DiscordGuildMemberIdentity[]> {
    const normalizedGuildId = normalizeRequiredString(input.guildId, 'guild_id');
    const normalizedQuery = input.query.trim();

    if (!normalizedQuery) {
      throw new HttpError('query is required', 400);
    }

    const requestedLimit = input.limit;
    const limit = Number.isInteger(requestedLimit) && (requestedLimit ?? 0) > 0
      ? Math.min(requestedLimit ?? 25, 100)
      : 25;

    const response = await this.request(
      `/guilds/${encodeURIComponent(normalizedGuildId)}/members/search?query=${encodeURIComponent(normalizedQuery)}&limit=${limit}`,
    );

    if (response.status === 401 || response.status === 403) {
      throw new HttpError('invalid bot_token or bot has no access to search guild members', 400);
    }

    if (response.status === 404) {
      throw new HttpError('discord guild not found or bot is not in this guild', 404);
    }

    if (response.status === 429) {
      throw new HttpError('discord rate limit exceeded, please retry later', 429);
    }

    if (!response.ok) {
      const detail = await getDiscordErrorMessage(response);
      throw new HttpError(
        detail ? `failed to search Discord guild members: ${detail}` : 'failed to search Discord guild members',
        502,
      );
    }

    const payload = await parseJsonSafe(response);
    if (!Array.isArray(payload)) {
      throw new HttpError('discord guild member search response is invalid', 502);
    }

    return payload
      .map((item) => this.toGuildMemberIdentity(item))
      .filter((item): item is DiscordGuildMemberIdentity => item !== null);
  }

  async fetchGuildMember(input: {
    guildId: string;
    userId: string;
  }): Promise<DiscordGuildMemberIdentity | null> {
    const normalizedGuildId = normalizeRequiredString(input.guildId, 'guild_id');
    const normalizedUserId = normalizeRequiredString(input.userId, 'user_id');
    const response = await this.request(
      `/guilds/${encodeURIComponent(normalizedGuildId)}/members/${encodeURIComponent(normalizedUserId)}`,
    );

    if (response.status === 404) {
      return null;
    }

    if (response.status === 401 || response.status === 403) {
      throw new HttpError('invalid bot_token or bot has no access to fetch guild member', 400);
    }

    if (response.status === 429) {
      throw new HttpError('discord rate limit exceeded, please retry later', 429);
    }

    if (!response.ok) {
      const detail = await getDiscordErrorMessage(response);
      throw new HttpError(
        detail ? `failed to fetch Discord guild member: ${detail}` : 'failed to fetch Discord guild member',
        502,
      );
    }

    const identity = this.toGuildMemberIdentity(await parseJsonSafe(response));
    if (!identity) {
      throw new HttpError('discord guild member response is invalid', 502);
    }

    return identity;
  }

  async postChannelMessage(input: {
    channelId: string;
    content: string;
  }): Promise<{
    messageId: string;
    channelId: string;
  }> {
    const normalizedContent = input.content.trim();
    if (!normalizedContent) {
      throw new HttpError('content is required', 400);
    }

    if (normalizedContent.length > 2000) {
      throw new HttpError('content must be 2000 characters or less', 400);
    }

    const normalizedChannelId = normalizeRequiredString(input.channelId, 'channel_id');
    const response = await this.request(
      `/channels/${encodeURIComponent(normalizedChannelId)}/messages`,
      {
        method: 'POST',
        body: {
          content: normalizedContent,
        },
      },
    );

    if (response.status === 401 || response.status === 403) {
      throw new HttpError('invalid bot_token or bot cannot send message to this channel', 400);
    }

    if (response.status === 404) {
      throw new HttpError('discord channel not found', 404);
    }

    if (response.status === 429) {
      throw new HttpError('discord rate limit exceeded, please retry later', 429);
    }

    if (!response.ok) {
      const detail = await getDiscordErrorMessage(response);
      throw new HttpError(
        detail ? `failed to send message to Discord channel: ${detail}` : 'failed to send message to Discord channel',
        502,
      );
    }

    const payload = await parseJsonSafe(response) as DiscordMessagePayload | null;
    if (!payload || typeof payload.id !== 'string' || typeof payload.channel_id !== 'string') {
      throw new HttpError('discord message response is invalid', 502);
    }

    return {
      messageId: payload.id,
      channelId: payload.channel_id,
    };
  }

  private async createDmChannel(recipientUserId: string): Promise<string> {
    const normalizedUserId = normalizeRequiredString(recipientUserId, 'recipient_user_id');
    const response = await this.request('/users/@me/channels', {
      method: 'POST',
      body: {
        recipient_id: normalizedUserId,
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw new HttpError('invalid bot_token or bot cannot start DM with this user', 400);
    }

    if (response.status === 404 || response.status === 400) {
      throw new HttpError('discord user not found or bot cannot open DM', 400);
    }

    if (response.status === 429) {
      throw new HttpError('discord rate limit exceeded, please retry later', 429);
    }

    if (!response.ok) {
      const detail = await getDiscordErrorMessage(response);
      throw new HttpError(
        detail ? `failed to create Discord DM channel: ${detail}` : 'failed to create Discord DM channel',
        502,
      );
    }

    const payload = await parseJsonSafe(response) as DiscordChannelPayload | null;
    if (!payload || typeof payload.id !== 'string') {
      throw new HttpError('discord DM channel response is invalid', 502);
    }

    return payload.id;
  }

  async sendDirectMessage(input: {
    recipientUserId: string;
    content: string;
  }): Promise<{
    dmChannelId: string;
    messageId: string;
  }> {
    const dmChannelId = await this.createDmChannel(input.recipientUserId);

    const sent = await this.postChannelMessage({
      channelId: dmChannelId,
      content: input.content,
    });

    return {
      dmChannelId,
      messageId: sent.messageId,
    };
  }

  async kickGuildMember(input: {
    guildId: string;
    userId: string;
  }): Promise<void> {
    const response = await this.request(
      `/guilds/${encodeURIComponent(input.guildId)}/members/${encodeURIComponent(input.userId)}`,
      { method: 'DELETE' },
    );

    if (response.status === 204 || response.status === 200) {
      return;
    }

    if (response.status === 404) {
      return;
    }

    const errorMessage = await getDiscordErrorMessage(response);
    throw new HttpError(
      errorMessage ?? `failed to kick member (HTTP ${response.status})`,
      502,
    );
  }

  async addGuildMember(input: {
    guildId: string;
    userId: string;
    userAccessToken: string;
  }): Promise<void> {
    const response = await this.request(
      `/guilds/${encodeURIComponent(input.guildId)}/members/${encodeURIComponent(input.userId)}`,
      {
        method: 'PUT',
        body: {
          access_token: normalizeRequiredString(input.userAccessToken, 'user_access_token'),
        },
      },
    );

    if (response.status === 201 || response.status === 204) {
      return;
    }

    const errorMessage = await getDiscordErrorMessage(response);
    throw new HttpError(
      errorMessage ?? `failed to add guild member (HTTP ${response.status})`,
      response.status === 401 || response.status === 403 ? 400 : 502,
    );
  }

  async createGuildInvite(input: {
    channelId: string;
    maxAge?: number;
    maxUses?: number;
  }): Promise<{ code: string; url: string }> {
    const response = await this.request(
      `/channels/${encodeURIComponent(input.channelId)}/invites`,
      {
        method: 'POST',
        body: {
          max_age: input.maxAge ?? 86400,
          max_uses: input.maxUses ?? 1,
          unique: true,
        },
      },
    );

    if (!response.ok) {
      const errorMessage = await getDiscordErrorMessage(response);
      throw new HttpError(
        errorMessage ?? `failed to create invite (HTTP ${response.status})`,
        502,
      );
    }

    const payload = await parseJsonSafe(response) as { code?: string } | null;
    if (!payload?.code) {
      throw new HttpError('discord invite response is invalid', 502);
    }

    return {
      code: payload.code,
      url: `https://discord.gg/${payload.code}`,
    };
  }

  private toGuildMemberIdentity(item: unknown): DiscordGuildMemberIdentity | null {
    if (typeof item !== 'object' || item === null) {
      return null;
    }

    const member = item as DiscordGuildMemberPayload;
    if (!member.user || typeof member.user.id !== 'string') {
      return null;
    }

    return {
      user_id: member.user.id,
      username: typeof member.user.username === 'string' && member.user.username.trim().length > 0
        ? member.user.username.trim()
        : null,
      global_name: typeof member.user.global_name === 'string' && member.user.global_name.trim().length > 0
        ? member.user.global_name.trim()
        : null,
      discriminator: typeof member.user.discriminator === 'string' && member.user.discriminator.trim().length > 0
        ? member.user.discriminator.trim()
        : null,
      nick: typeof member.nick === 'string' && member.nick.trim().length > 0 ? member.nick.trim() : null,
    };
  }
}

export type DiscordBotCredentialSource = {
  findDefault(): Promise<{ bot_token: string | null } | null>;
};

export class DiscordClientFactory {
  constructor(private readonly credentialSource: DiscordBotCredentialSource) {}

  async getClient(botToken?: string | null): Promise<DiscordClient> {
    const provided = botToken?.trim();
    if (provided) {
      return new DiscordClient(provided);
    }

    const credential = await this.credentialSource.findDefault();
    const stored = credential?.bot_token?.trim();
    if (!stored) {
      throw new HttpError('discord is not available right now', 503);
    }

    return new DiscordClient(stored);
  }
}
