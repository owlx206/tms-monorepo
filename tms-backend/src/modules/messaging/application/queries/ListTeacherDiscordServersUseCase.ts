type MessagingReader = {
  listTeacherDiscordServers(teacherId: number): Promise<Array<{
    id: number;
    teacher_id: number;
    discord_server_id: string;
    name: string;
    synced_at: Date;
    binding_server_id: number | null;
    binding_role: 'unbound' | 'class';
    binding_class_id: number | null;
    binding_class_name: string | null;
    binding_notification_channel_id: string | null;
    binding_notification_channel_name: string | null;
    binding_notification_channel_cache_id: number | null;
    binding_attendance_voice_channel_id: string | null;
    binding_attendance_voice_channel_name: string | null;
    binding_attendance_voice_channel_cache_id: number | null;
  }>>;
};

export class ListTeacherDiscordServersUseCase {
  constructor(private readonly messaging: MessagingReader) {}

  execute(teacherId: number) {
    return this.messaging.listTeacherDiscordServers(teacherId).then((servers) => servers.map((server) => ({
      id: server.id,
      teacher_id: server.teacher_id,
      discord_server_id: server.discord_server_id,
      name: server.name,
      synced_at: server.synced_at,
      binding: {
        role: server.binding_role,
        server_binding_id: server.binding_server_id,
        class_id: server.binding_class_id,
        class_name: server.binding_class_name,
        notification_channel_id: server.binding_notification_channel_id,
        notification_channel_name: server.binding_notification_channel_name,
        notification_channel_cache_id: server.binding_notification_channel_cache_id,
        attendance_voice_channel_id: server.binding_attendance_voice_channel_id,
        attendance_voice_channel_name: server.binding_attendance_voice_channel_name,
        attendance_voice_channel_cache_id: server.binding_attendance_voice_channel_cache_id,
      },
    })));
  }
}
