import type { DiscordMessageType } from '../../../../entities/enums.js';

export type MessageRecipientCount = {
  message_id: string;
  total: string;
  sent: string;
  failed: string;
};

export type FailedMessageRecipient = {
  message_id: string;
  student_id: string;
  student_name: string | null;
  error_detail: string | null;
};

export interface MessagingReadRepository {
  listDiscordServersForTeacher(teacherId: number): Promise<Array<{
    id: number;
    teacher_id: number;
    class_id: number;
    discord_server_id: string;
    bot_token: string | null;
    name: string | null;
    attendance_voice_channel_id: string | null;
    notification_channel_id: string | null;
  }>>;
  listMessagesForTeacher(teacherId: number, filters: {
    type?: DiscordMessageType;
  }): Promise<Array<{
    id: number;
    teacher_id: number;
    server_id: number | null;
    type: DiscordMessageType;
    content: string;
    created_at: Date;
  }>>;
  countRecipientsByMessageIds(teacherId: number, messageIds: number[]): Promise<MessageRecipientCount[]>;
  listFailedRecipientsByMessageIds(teacherId: number, messageIds: number[]): Promise<FailedMessageRecipient[]>;
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
  listTeacherDiscordChannelsForServer(teacherId: number, discordServerId: string): Promise<Array<{
    id: number;
    teacher_id: number;
    discord_server_id: string;
    discord_channel_id: string;
    name: string;
    type: 'text' | 'voice';
    synced_at: Date;
  }>>;
  countActiveStudentsForTeacher(teacherId: number): Promise<number>;
  countActiveStudentsWithDiscordUsernameForTeacher(teacherId: number): Promise<number>;
  countActiveClassesForTeacher(teacherId: number): Promise<number>;
  countConfiguredDiscordServersForTeacher(teacherId: number): Promise<number>;
  listActiveClassesMissingDiscordServerNamesForTeacher(teacherId: number): Promise<string[]>;
  countTeacherDiscordServerCaches(teacherId: number): Promise<number>;
}
