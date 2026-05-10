import type { DiscordMessage } from '../../../../../entities/discord-message.entity.js';
import type { DiscordMessageRecipient } from '../../../../../entities/discord-message-recipient.entity.js';
import type { DiscordServer } from '../../../../../entities/discord-server.entity.js';
import type { TeacherDiscordChannelCache } from '../../../../../entities/teacher-discord-channel-cache.entity.js';
import type { TeacherDiscordServerCache } from '../../../../../entities/teacher-discord-server-cache.entity.js';
import type { DiscordServerContext } from '../../../application/ports/DiscordRecipientResolverPort.js';

export type BulkDmRecipientContext = {
  student_id: number;
  student_name: string;
  discord_username: string | null;
  active_class_id: number | null;
  discord_server: DiscordServerContext | null;
};

export type DiscordMembershipSyncStudent = {
  student_id: number;
  student_name: string;
  discord_username: string | null;
  discord_user_id: string | null;
  discord_access_token: string | null;
  discord_refresh_token: string | null;
  discord_token_expires_at: Date | null;
  status: string;
  active_class_id: number | null;
  active_class_name: string | null;
  last_class_id: number | null;
  last_class_name: string | null;
  class_server: DiscordServerContext | null;
  last_class_server: DiscordServerContext | null;
};

export interface MessagingWriteRepository {
  findDiscordServerByClass(teacherId: number, classId: number): Promise<DiscordServer | null>;
  removeDiscordServer(server: DiscordServer): Promise<DiscordServer>;
  createDiscordServer(values: Partial<DiscordServer>): DiscordServer;
  saveDiscordServer(server: DiscordServer): Promise<DiscordServer>;
  replaceTeacherDiscordServerCaches(
    teacherId: number,
    servers: Array<{ discord_server_id: string; name: string }>,
  ): Promise<TeacherDiscordServerCache[]>;
  listTeacherDiscordServerCaches(teacherId: number): Promise<TeacherDiscordServerCache[]>;
  findTeacherDiscordServerCacheByDiscordServerId(
    teacherId: number,
    discordServerId: string,
  ): Promise<TeacherDiscordServerCache | null>;
  findAnyTeacherDiscordServerCacheByDiscordServerId(discordServerId: string): Promise<TeacherDiscordServerCache | null>;
  createTeacherDiscordServerCache(values: Partial<TeacherDiscordServerCache>): TeacherDiscordServerCache;
  saveTeacherDiscordServerCache(server: TeacherDiscordServerCache): Promise<TeacherDiscordServerCache>;
  replaceTeacherDiscordChannelCaches(
    teacherId: number,
    discordServerId: string,
    channels: Array<{ discord_channel_id: string; name: string; type: 'text' | 'voice' }>,
  ): Promise<TeacherDiscordChannelCache[]>;
  findTeacherDiscordServerCacheById(teacherId: number, serverCacheId: number): Promise<TeacherDiscordServerCache | null>;
  findTeacherDiscordChannelCacheById(teacherId: number, channelCacheId: number): Promise<TeacherDiscordChannelCache | null>;
  findDiscordServerByDiscordServerId(teacherId: number, discordServerId: string): Promise<DiscordServer | null>;
  listBulkDmRecipientContextsByStudentIds(teacherId: number, studentIds: number[]): Promise<BulkDmRecipientContext[]>;
  listBulkDmRecipientContextsByClass(teacherId: number, classId: number): Promise<BulkDmRecipientContext[]>;
  findDiscordServersByIds(teacherId: number, serverIds: number[]): Promise<DiscordServer[]>;
  listDiscordMembershipSyncStudents(teacherId: number): Promise<DiscordMembershipSyncStudent[]>;
  updateStudentDiscordUserId(teacherId: number, studentId: number, discordUserId: string): Promise<void>;
  updateStudentDiscordAuthorization(input: {
    teacherId: number;
    studentId: number;
    discordUserId: string;
    discordUsername: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    authorizedAt: Date;
  }): Promise<void>;
  updateStudentDiscordTokens(input: {
    teacherId: number;
    studentId: number;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
  }): Promise<void>;
  createMessageWithRecipients(input: {
    messageValues: Partial<DiscordMessage>;
    recipientValues: Array<Partial<DiscordMessageRecipient>>;
  }): Promise<{ message: DiscordMessage; recipients: DiscordMessageRecipient[] }>;
  createChannelPostMessages(values: Array<Partial<DiscordMessage>>): Promise<DiscordMessage[]>;
}
