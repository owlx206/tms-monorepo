import type { TeacherDiscordChannelReader } from '../../contracts/types.js';

export class ListTeacherDiscordChannelsUseCase {
  constructor(private readonly messaging: TeacherDiscordChannelReader) {}

  execute(teacherId: number, discordGuildId: string) {
    return this.messaging.listTeacherDiscordChannelsForGuild(teacherId, discordGuildId);
  }
}
