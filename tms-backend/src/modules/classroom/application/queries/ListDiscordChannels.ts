import type { TeacherDiscordChannelOption } from '../../contracts/types.js';
import { listTeacherDiscordChannelsForGuild } from '../../infrastructure/persistence/typeorm/Reader.js';

export class ListDiscordChannels {
  execute(teacherId: number, discordGuildId: string): Promise<TeacherDiscordChannelOption[]> {
    return listTeacherDiscordChannelsForGuild(teacherId, discordGuildId);
  }
}
