type MessagingReader = {
  listTeacherDiscordChannelsForServer(teacherId: number, discordServerId: string): Promise<Array<{
    id: number;
    teacher_id: number;
    discord_server_id: string;
    discord_channel_id: string;
    name: string;
    type: 'text' | 'voice';
    synced_at: Date;
  }>>;
};

export class ListTeacherDiscordChannelsUseCase {
  constructor(private readonly messaging: MessagingReader) {}

  execute(teacherId: number, discordServerId: string) {
    return this.messaging.listTeacherDiscordChannelsForServer(teacherId, discordServerId);
  }
}
