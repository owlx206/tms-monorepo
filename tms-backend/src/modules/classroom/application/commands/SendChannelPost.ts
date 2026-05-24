import {
  ensureDiscordChannelBelongsToGuild,
  postDiscordChannelMessage,
  resolveDiscordBotToken,
  type DiscordBotCredentialSource,
} from '../../../../infrastructure/external/discord/discord.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { ChannelPostInput } from '../../contracts/types.js';
import type { TypeOrmClassroomDiscordWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

function normalizeIdArray(values: number[] | undefined): number[] {
  if (!values) {
    return [];
  }

  return Array.from(new Set(values.filter((item) => Number.isInteger(item) && item > 0)));
}

function toFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export class SendChannelPost {
  constructor(
    private readonly classroomDiscordWriter: TypeOrmClassroomDiscordWriter,
    private readonly discordBotCredentialSource: DiscordBotCredentialSource,
  ) {}

  async execute(teacherId: number, input: ChannelPostInput) {
    const { content } = input;
    const guildIds = normalizeIdArray(input.guild_ids);
    const guilds = await this.classroomDiscordWriter.findDiscordGuildsByIds(teacherId, guildIds);

    if (guilds.length !== guildIds.length) {
      throw new HttpError('some guilds are invalid', 404);
    }

    const guildById = new Map(guilds.map((guild) => [guild.id, guild]));
    const orderedGuilds = guildIds
      .map((guildId) => guildById.get(guildId))
      .filter((item): item is NonNullable<typeof item> => item !== undefined);

    const successfulGuilds: typeof orderedGuilds = [];
    const failures: Array<{ guild_id: number; error: string }> = [];
    const botToken = await resolveDiscordBotToken(this.discordBotCredentialSource);

    for (const guild of orderedGuilds) {
      if (!guild.notification_channel_id) {
        failures.push({ guild_id: guild.id, error: 'notification_channel_id is missing' });
        continue;
      }

      try {
        await ensureDiscordChannelBelongsToGuild({
          botToken,
          channelId: guild.notification_channel_id,
          guildId: guild.discord_guild_id,
          fieldName: 'notification_channel_id',
        });
        await postDiscordChannelMessage({
          botToken,
          channelId: guild.notification_channel_id,
          content,
        });
        successfulGuilds.push(guild);
      } catch (error) {
        failures.push({
          guild_id: guild.id,
          error: toFailureMessage(error, 'failed to send message'),
        });
      }
    }

    return {
      targets_total: orderedGuilds.length,
      sent: successfulGuilds.length,
      failed: failures.length,
      failures,
    };
  }
}
