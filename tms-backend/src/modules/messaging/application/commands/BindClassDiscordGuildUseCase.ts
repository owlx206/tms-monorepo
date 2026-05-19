import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { SelectClassDiscordGuildInput } from '../../contracts/types.js';
import type { TypeOrmMessagingWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

export class BindClassDiscordGuildUseCase {
  constructor(private readonly messagingWriter: TypeOrmMessagingWriter) {}

  async execute(teacherId: number, classId: number, input: SelectClassDiscordGuildInput) {
    const userGuild = await this.messagingWriter.findDiscordUserGuildById(
      teacherId,
      input.guild_id,
    );

    if (!userGuild) {
      throw new HttpError('selected guild is invalid', 404);
    }

    const notificationChannel = input.notification_channel_id
      ? await this.messagingWriter.findDiscordGuildChannelCacheById(teacherId, Number(input.notification_channel_id))
      : null;
    const voiceChannel = input.attendance_voice_channel_id
      ? await this.messagingWriter.findDiscordGuildChannelCacheById(teacherId, Number(input.attendance_voice_channel_id))
      : null;

    if (notificationChannel && notificationChannel.discord_guild_id !== userGuild.discord_guild_id) {
      throw new HttpError('notification channel does not belong to selected guild', 400);
    }

    if (notificationChannel && notificationChannel.type !== 'text') {
      throw new HttpError('notification channel must be a text channel', 400);
    }

    if (voiceChannel && voiceChannel.discord_guild_id !== userGuild.discord_guild_id) {
      throw new HttpError('voice channel does not belong to selected guild', 400);
    }

    if (voiceChannel && voiceChannel.type !== 'voice') {
      throw new HttpError('voice channel must be a voice channel', 400);
    }

    const existing = await this.messagingWriter.findDiscordGuildByClass(teacherId, classId);
    const existingByGuild = await this.messagingWriter.findDiscordGuildByDiscordGuildId(
      teacherId,
      userGuild.discord_guild_id,
    );

    if (existingByGuild && existingByGuild.class_id !== classId) {
      throw new HttpError('selected guild is already bound to another class', 409);
    }

    if (existing) {
      if (existing.discord_guild_id !== userGuild.discord_guild_id) {
        throw new HttpError('current class already has another guild binding', 409);
      }

      existing.discord_guild_id = userGuild.discord_guild_id;
      existing.name = userGuild.name;
      existing.notification_channel_id = notificationChannel?.discord_channel_id ?? null;
      existing.attendance_voice_channel_id = voiceChannel?.discord_channel_id ?? null;
      return this.messagingWriter.saveClassDiscordBinding(existing);
    }

    return this.messagingWriter.saveClassDiscordBinding(
      this.messagingWriter.createClassDiscordBinding({
        teacher_id: teacherId,
        class_id: classId,
        discord_guild_id: userGuild.discord_guild_id,
        name: userGuild.name,
        notification_channel_id: notificationChannel?.discord_channel_id ?? null,
        attendance_voice_channel_id: voiceChannel?.discord_channel_id ?? null,
        bot_token: null,
      }),
    );
  }
}
