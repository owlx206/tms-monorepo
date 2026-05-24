import type { TeacherDiscordGuildOption } from '../../contracts/types.js';
import { listTeacherDiscordGuilds } from '../../infrastructure/persistence/typeorm/Reader.js';

export class ListDiscordGuilds {
  async execute(teacherId: number): Promise<TeacherDiscordGuildOption[]> {
    return (await listTeacherDiscordGuilds(teacherId)).map((guild) => ({
      id: guild.id,
      teacher_id: guild.teacher_id,
      discord_guild_id: guild.discord_guild_id,
      name: guild.name,
      synced_at: guild.synced_at,
      binding: {
        role: guild.binding_role,
        guild_binding_id: guild.binding_guild_id,
        class_id: guild.binding_class_id,
        class_name: guild.binding_class_name,
        notification_channel_id: guild.binding_notification_channel_id,
        notification_channel_name: guild.binding_notification_channel_name,
        notification_channel_cache_id: guild.binding_notification_channel_cache_id,
        attendance_voice_channel_id: guild.binding_attendance_voice_channel_id,
        attendance_voice_channel_name: guild.binding_attendance_voice_channel_name,
        attendance_voice_channel_cache_id: guild.binding_attendance_voice_channel_cache_id,
      },
    }));
  }
}
