import { ServiceError } from '../../../shared/errors/service.error.js';

const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';

type DiscordApiErrorPayload = {
  message?: string;
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
    throw new ServiceError(`${fieldName} is required`, 400);
  }

  return normalized;
}

function parseDiscordErrorMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const errorPayload = payload as DiscordApiErrorPayload;
  if (typeof errorPayload.message !== 'string' || errorPayload.message.trim().length === 0) {
    return null;
  }

  return errorPayload.message.trim();
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function getDiscordErrorMessage(response: Response): Promise<string | null> {
  const payload = await parseJsonSafe(response);
  return parseDiscordErrorMessage(payload);
}

async function discordApiRequest(
  path: string,
  botToken: string,
  options?: {
    method?: 'GET' | 'POST' | 'DELETE' | 'PUT';
    body?: Record<string, unknown>;
  },
): Promise<Response> {
  const normalizedBotToken = normalizeRequiredString(botToken, 'bot_token');
  const requestInit: RequestInit = {
    method: options?.method ?? 'GET',
    headers: {
      Authorization: `Bot ${normalizedBotToken}`,
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
  };

  try {
    return await fetch(`${DISCORD_API_BASE_URL}${path}`, requestInit);
  } catch {
    throw new ServiceError('failed to connect to Discord API', 502);
  }
}

async function fetchDiscordGuildFromInviteCode(inviteCode: string, botToken: string): Promise<{
  id: string;
  name: string;
} | null> {
  const normalizedInviteCode = inviteCode.trim();
  if (!normalizedInviteCode) {
    return null;
  }

  const response = await discordApiRequest(
    `/invites/${encodeURIComponent(normalizedInviteCode)}?with_counts=false&with_expiration=false`,
    botToken,
  );

  if (response.status === 404) {
    return null;
  }

  if (response.status === 401 || response.status === 403) {
    throw new ServiceError('invalid bot_token or bot has no access to this invite', 400);
  }

  if (!response.ok) {
    const detail = await getDiscordErrorMessage(response);
    throw new ServiceError(
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

export async function fetchDiscordGuildMetadata(discordServerId: string, botToken: string): Promise<{
  id: string;
  name: string;
}> {
  const rawServerId = normalizeRequiredString(discordServerId, 'discord_server_id');
  const inviteCode = extractDiscordInviteCode(rawServerId);
  let guildIdCandidate = extractGuildIdCandidate(rawServerId);
  if (!isDiscordSnowflake(guildIdCandidate) && inviteCode) {
    const guildFromInvite = await fetchDiscordGuildFromInviteCode(inviteCode, botToken);
    if (guildFromInvite) {
      guildIdCandidate = guildFromInvite.id;
    }
  }

  if (!isDiscordSnowflake(guildIdCandidate)) {
    throw new ServiceError(
      'discord_server_id must be a valid Discord Server ID (Guild ID) or Discord server URL',
      400,
    );
  }

  const response = await discordApiRequest(`/guilds/${encodeURIComponent(guildIdCandidate)}`, botToken);

  if (response.status === 401 || response.status === 403) {
    throw new ServiceError('invalid bot_token or bot has no access to this server', 400);
  }

  if (response.status === 404) {
    const channelIdCandidate = extractChannelIdCandidate(rawServerId);
    if (channelIdCandidate) {
      try {
        const channel = await fetchDiscordChannelMetadata(channelIdCandidate, botToken);
        if (channel.guild_id) {
          const guildResponseFromChannel = await discordApiRequest(
            `/guilds/${encodeURIComponent(channel.guild_id)}`,
            botToken,
          );

          if (guildResponseFromChannel.ok) {
            const guildPayload = extractGuildPayload(await parseJsonSafe(guildResponseFromChannel));
            if (guildPayload) {
              return guildPayload;
            }
          }
        }
      } catch (error) {
        if (error instanceof ServiceError && error.statusCode !== 404) {
          throw error;
        }
      }
    }

    throw new ServiceError(
      'discord server not found or bot is not in this server (hãy dùng đúng Server ID/Guild ID và đảm bảo bot đã được mời vào server)',
      404,
    );
  }

  if (!response.ok) {
    const detail = await getDiscordErrorMessage(response);
    throw new ServiceError(
      detail ? `failed to sync discord server metadata: ${detail}` : 'failed to sync discord server metadata',
      502,
    );
  }

  const payload = extractGuildPayload(await parseJsonSafe(response));
  if (!payload) {
    throw new ServiceError('discord server metadata is invalid', 502);
  }

  return payload;
}

export async function fetchDiscordChannelMetadata(channelId: string, botToken: string): Promise<{
  id: string;
  guild_id: string | null;
  name: string | null;
}> {
  const normalizedChannelId = normalizeRequiredString(channelId, 'channel_id');
  const response = await discordApiRequest(`/channels/${encodeURIComponent(normalizedChannelId)}`, botToken);

  if (response.status === 401 || response.status === 403) {
    throw new ServiceError('invalid bot_token or bot has no access to this channel', 400);
  }

  if (response.status === 404) {
    throw new ServiceError('discord channel not found', 404);
  }

  if (!response.ok) {
    const detail = await getDiscordErrorMessage(response);
    throw new ServiceError(
      detail ? `failed to fetch discord channel metadata: ${detail}` : 'failed to fetch discord channel metadata',
      502,
    );
  }

  const payload = await parseJsonSafe(response) as DiscordChannelPayload | null;
  if (!payload || typeof payload.id !== 'string') {
    throw new ServiceError('discord channel metadata is invalid', 502);
  }

  return {
    id: payload.id,
    guild_id: typeof payload.guild_id === 'string' ? payload.guild_id : null,
    name: typeof payload.name === 'string' && payload.name.trim().length > 0 ? payload.name.trim() : null,
  };
}

export async function listDiscordGuilds(botToken: string): Promise<Array<{ id: string; name: string }>> {
  const response = await discordApiRequest('/users/@me/guilds', botToken);

  if (response.status === 401 || response.status === 403) {
    throw new ServiceError('invalid bot_token or bot cannot list guilds', 400);
  }

  if (!response.ok) {
    const detail = await getDiscordErrorMessage(response);
    throw new ServiceError(
      detail ? `failed to list Discord guilds: ${detail}` : 'failed to list Discord guilds',
      502,
    );
  }

  const payload = await parseJsonSafe(response);
  if (!Array.isArray(payload)) {
    throw new ServiceError('discord guild list response is invalid', 502);
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

export async function checkDiscordBotTokenHealth(botToken: string): Promise<{
  healthy: boolean;
  message: string;
}> {
  const response = await discordApiRequest('/users/@me', botToken);

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

export async function listDiscordGuildChannels(input: {
  guildId: string;
  botToken: string;
}): Promise<Array<{ id: string; name: string; type: 'text' | 'voice' }>> {
  const guildId = normalizeRequiredString(input.guildId, 'guild_id');
  const response = await discordApiRequest(`/guilds/${encodeURIComponent(guildId)}/channels`, input.botToken);

  if (response.status === 401 || response.status === 403) {
    throw new ServiceError('invalid bot_token or bot cannot list guild channels', 400);
  }

  if (response.status === 404) {
    throw new ServiceError('discord server not found or bot is not in this server', 404);
  }

  if (!response.ok) {
    const detail = await getDiscordErrorMessage(response);
    throw new ServiceError(
      detail ? `failed to list Discord guild channels: ${detail}` : 'failed to list Discord guild channels',
      502,
    );
  }

  const payload = await parseJsonSafe(response);
  if (!Array.isArray(payload)) {
    throw new ServiceError('discord guild channel list response is invalid', 502);
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

export async function ensureDiscordChannelBelongsToGuild(input: {
  channelId: string;
  guildId: string;
  botToken: string;
  fieldName: string;
}): Promise<void> {
  const channel = await fetchDiscordChannelMetadata(input.channelId, input.botToken);
  if (channel.guild_id !== input.guildId) {
    throw new ServiceError(`${input.fieldName} does not belong to discord_server_id`, 400);
  }
}

export type DiscordGuildMemberIdentity = {
  user_id: string;
  username: string | null;
  global_name: string | null;
  discriminator: string | null;
  nick: string | null;
};

export async function searchDiscordGuildMembers(input: {
  guildId: string;
  query: string;
  botToken: string;
  limit?: number;
}): Promise<DiscordGuildMemberIdentity[]> {
  const normalizedGuildId = normalizeRequiredString(input.guildId, 'guild_id');
  const normalizedQuery = input.query.trim();

  if (!normalizedQuery) {
    throw new ServiceError('query is required', 400);
  }

  const requestedLimit = input.limit;
  const limit = Number.isInteger(requestedLimit) && (requestedLimit ?? 0) > 0
    ? Math.min(requestedLimit ?? 25, 100)
    : 25;

  const response = await discordApiRequest(
    `/guilds/${encodeURIComponent(normalizedGuildId)}/members/search?query=${encodeURIComponent(normalizedQuery)}&limit=${limit}`,
    input.botToken,
  );

  if (response.status === 401 || response.status === 403) {
    throw new ServiceError('invalid bot_token or bot has no access to search guild members', 400);
  }

  if (response.status === 404) {
    throw new ServiceError('discord server not found or bot is not in this server', 404);
  }

  if (response.status === 429) {
    throw new ServiceError('discord rate limit exceeded, please retry later', 429);
  }

  if (!response.ok) {
    const detail = await getDiscordErrorMessage(response);
    throw new ServiceError(
      detail ? `failed to search Discord guild members: ${detail}` : 'failed to search Discord guild members',
      502,
    );
  }

  const payload = await parseJsonSafe(response);
  if (!Array.isArray(payload)) {
    throw new ServiceError('discord guild member search response is invalid', 502);
  }

  return payload
    .map((item) => {
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
      } satisfies DiscordGuildMemberIdentity;
    })
    .filter((item): item is DiscordGuildMemberIdentity => item !== null);
}

export async function fetchDiscordGuildMember(input: {
  guildId: string;
  userId: string;
  botToken: string;
}): Promise<DiscordGuildMemberIdentity | null> {
  const normalizedGuildId = normalizeRequiredString(input.guildId, 'guild_id');
  const normalizedUserId = normalizeRequiredString(input.userId, 'user_id');
  const response = await discordApiRequest(
    `/guilds/${encodeURIComponent(normalizedGuildId)}/members/${encodeURIComponent(normalizedUserId)}`,
    input.botToken,
  );

  if (response.status === 404) {
    return null;
  }

  if (response.status === 401 || response.status === 403) {
    throw new ServiceError('invalid bot_token or bot has no access to fetch guild member', 400);
  }

  if (response.status === 429) {
    throw new ServiceError('discord rate limit exceeded, please retry later', 429);
  }

  if (!response.ok) {
    const detail = await getDiscordErrorMessage(response);
    throw new ServiceError(
      detail ? `failed to fetch Discord guild member: ${detail}` : 'failed to fetch Discord guild member',
      502,
    );
  }

  const member = await parseJsonSafe(response) as DiscordGuildMemberPayload | null;
  if (!member?.user || typeof member.user.id !== 'string') {
    throw new ServiceError('discord guild member response is invalid', 502);
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

export async function postDiscordChannelMessage(input: {
  botToken: string;
  channelId: string;
  content: string;
}): Promise<{
  messageId: string;
  channelId: string;
}> {
  const normalizedContent = input.content.trim();
  if (!normalizedContent) {
    throw new ServiceError('content is required', 400);
  }

  if (normalizedContent.length > 2000) {
    throw new ServiceError('content must be 2000 characters or less', 400);
  }

  const normalizedChannelId = normalizeRequiredString(input.channelId, 'channel_id');
  const response = await discordApiRequest(
    `/channels/${encodeURIComponent(normalizedChannelId)}/messages`,
    input.botToken,
    {
      method: 'POST',
      body: {
        content: normalizedContent,
      },
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new ServiceError('invalid bot_token or bot cannot send message to this channel', 400);
  }

  if (response.status === 404) {
    throw new ServiceError('discord channel not found', 404);
  }

  if (response.status === 429) {
    throw new ServiceError('discord rate limit exceeded, please retry later', 429);
  }

  if (!response.ok) {
    const detail = await getDiscordErrorMessage(response);
    throw new ServiceError(
      detail ? `failed to send message to Discord channel: ${detail}` : 'failed to send message to Discord channel',
      502,
    );
  }

  const payload = await parseJsonSafe(response) as DiscordMessagePayload | null;
  if (!payload || typeof payload.id !== 'string' || typeof payload.channel_id !== 'string') {
    throw new ServiceError('discord message response is invalid', 502);
  }

  return {
    messageId: payload.id,
    channelId: payload.channel_id,
  };
}

async function createDiscordDmChannel(input: {
  botToken: string;
  recipientUserId: string;
}): Promise<string> {
  const normalizedUserId = normalizeRequiredString(input.recipientUserId, 'recipient_user_id');
  const response = await discordApiRequest('/users/@me/channels', input.botToken, {
    method: 'POST',
    body: {
      recipient_id: normalizedUserId,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new ServiceError('invalid bot_token or bot cannot start DM with this user', 400);
  }

  if (response.status === 404 || response.status === 400) {
    throw new ServiceError('discord user not found or bot cannot open DM', 400);
  }

  if (response.status === 429) {
    throw new ServiceError('discord rate limit exceeded, please retry later', 429);
  }

  if (!response.ok) {
    const detail = await getDiscordErrorMessage(response);
    throw new ServiceError(
      detail ? `failed to create Discord DM channel: ${detail}` : 'failed to create Discord DM channel',
      502,
    );
  }

  const payload = await parseJsonSafe(response) as DiscordChannelPayload | null;
  if (!payload || typeof payload.id !== 'string') {
    throw new ServiceError('discord DM channel response is invalid', 502);
  }

  return payload.id;
}

export async function sendDiscordDirectMessage(input: {
  botToken: string;
  recipientUserId: string;
  content: string;
}): Promise<{
  dmChannelId: string;
  messageId: string;
}> {
  const dmChannelId = await createDiscordDmChannel({
    botToken: input.botToken,
    recipientUserId: input.recipientUserId,
  });

  const sent = await postDiscordChannelMessage({
    botToken: input.botToken,
    channelId: dmChannelId,
    content: input.content,
  });

  return {
    dmChannelId,
    messageId: sent.messageId,
  };
}

export async function kickGuildMember(input: {
  guildId: string;
  userId: string;
  botToken: string;
}): Promise<void> {
  const response = await discordApiRequest(
    `/guilds/${encodeURIComponent(input.guildId)}/members/${encodeURIComponent(input.userId)}`,
    input.botToken,
    { method: 'DELETE' },
  );

  if (response.status === 204 || response.status === 200) {
    return;
  }

  if (response.status === 404) {
    // Member not in guild, treat as success
    return;
  }

  const errorMessage = await getDiscordErrorMessage(response);
  throw new ServiceError(
    errorMessage ?? `failed to kick member (HTTP ${response.status})`,
    502,
  );
}

export async function addGuildMember(input: {
  guildId: string;
  userId: string;
  userAccessToken: string;
  botToken: string;
}): Promise<void> {
  const response = await discordApiRequest(
    `/guilds/${encodeURIComponent(input.guildId)}/members/${encodeURIComponent(input.userId)}`,
    input.botToken,
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
  throw new ServiceError(
    errorMessage ?? `failed to add guild member (HTTP ${response.status})`,
    response.status === 401 || response.status === 403 ? 400 : 502,
  );
}

export async function createGuildInvite(input: {
  channelId: string;
  botToken: string;
  maxAge?: number;
  maxUses?: number;
}): Promise<{ code: string; url: string }> {
  const response = await discordApiRequest(
    `/channels/${encodeURIComponent(input.channelId)}/invites`,
    input.botToken,
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
    throw new ServiceError(
      errorMessage ?? `failed to create invite (HTTP ${response.status})`,
      502,
    );
  }

  const payload = await parseJsonSafe(response) as { code?: string } | null;
  if (!payload?.code) {
    throw new ServiceError('discord invite response is invalid', 502);
  }

  return {
    code: payload.code,
    url: `https://discord.gg/${payload.code}`,
  };
}

export class DiscordClient {
  constructor(private readonly botToken: string) {}

  listGuilds(): Promise<Array<{ id: string; name: string }>> {
    return listDiscordGuilds(this.botToken);
  }

  checkBotTokenHealth(): Promise<{ healthy: boolean; message: string }> {
    return checkDiscordBotTokenHealth(this.botToken);
  }

  fetchGuildMetadata(discordServerId: string): Promise<{
    id: string;
    name: string;
  }> {
    return fetchDiscordGuildMetadata(discordServerId, this.botToken);
  }

  listGuildChannels(guildId: string): Promise<Array<{ id: string; name: string; type: 'text' | 'voice' }>> {
    return listDiscordGuildChannels({
      guildId,
      botToken: this.botToken,
    });
  }

  fetchChannelMetadata(channelId: string): Promise<{
    id: string;
    guild_id: string | null;
    name: string | null;
  }> {
    return fetchDiscordChannelMetadata(channelId, this.botToken);
  }

  ensureChannelBelongsToGuild(input: {
    channelId: string;
    guildId: string;
    fieldName: string;
  }): Promise<void> {
    return ensureDiscordChannelBelongsToGuild({
      ...input,
      botToken: this.botToken,
    });
  }

  searchGuildMembers(input: {
    guildId: string;
    query: string;
    limit?: number;
  }): Promise<DiscordGuildMemberIdentity[]> {
    return searchDiscordGuildMembers({
      ...input,
      botToken: this.botToken,
    });
  }

  fetchGuildMember(input: {
    guildId: string;
    userId: string;
  }): Promise<DiscordGuildMemberIdentity | null> {
    return fetchDiscordGuildMember({
      ...input,
      botToken: this.botToken,
    });
  }

  postChannelMessage(input: {
    channelId: string;
    content: string;
  }): Promise<{
    messageId: string;
    channelId: string;
  }> {
    return postDiscordChannelMessage({
      ...input,
      botToken: this.botToken,
    });
  }

  sendDirectMessage(input: {
    recipientUserId: string;
    content: string;
  }): Promise<{
    dmChannelId: string;
    messageId: string;
  }> {
    return sendDiscordDirectMessage({
      ...input,
      botToken: this.botToken,
    });
  }

  kickGuildMember(input: {
    guildId: string;
    userId: string;
  }): Promise<void> {
    return kickGuildMember({
      ...input,
      botToken: this.botToken,
    });
  }

  addGuildMember(input: {
    guildId: string;
    userId: string;
    userAccessToken: string;
  }): Promise<void> {
    return addGuildMember({
      ...input,
      botToken: this.botToken,
    });
  }

  createGuildInvite(input: {
    channelId: string;
    maxAge?: number;
    maxUses?: number;
  }): Promise<{ code: string; url: string }> {
    return createGuildInvite({
      ...input,
      botToken: this.botToken,
    });
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
      throw new ServiceError('discord bot is not configured by sysadmin', 503);
    }

    return new DiscordClient(stored);
  }
}
