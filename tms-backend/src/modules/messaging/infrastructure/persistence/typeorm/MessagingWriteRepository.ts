import type { DiscordMessage } from '../../../../../entities/discord-message.entity.js';
import type { DiscordMessageRecipient } from '../../../../../entities/discord-message-recipient.entity.js';
import type { DiscordServer } from '../../../../../entities/discord-server.entity.js';
import type { TeacherCommunityServer } from '../../../../../entities/teacher-community-server.entity.js';
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

export interface MessagingWriteRepository {
  findDiscordServerByClass(teacherId: number, classId: number): Promise<DiscordServer | null>;
  removeDiscordServer(server: DiscordServer): Promise<DiscordServer>;
  createDiscordServer(values: Partial<DiscordServer>): DiscordServer;
  saveDiscordServer(server: DiscordServer): Promise<DiscordServer>;
  findCommunityServerByTeacher(teacherId: number): Promise<TeacherCommunityServer | null>;
  createCommunityServer(values: Partial<TeacherCommunityServer>): TeacherCommunityServer;
  saveCommunityServer(server: TeacherCommunityServer): Promise<TeacherCommunityServer>;
  removeCommunityServer(server: TeacherCommunityServer): Promise<TeacherCommunityServer>;
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
  hasCommunityServerByDiscordServerId(teacherId: number, discordServerId: string): Promise<boolean>;
  findDiscordServerByDiscordServerId(teacherId: number, discordServerId: string): Promise<DiscordServer | null>;
  listBulkDmRecipientContextsByStudentIds(teacherId: number, studentIds: number[]): Promise<BulkDmRecipientContext[]>;
  listBulkDmRecipientContextsByClass(teacherId: number, classId: number): Promise<BulkDmRecipientContext[]>;
  findDiscordServersByIds(teacherId: number, serverIds: number[]): Promise<DiscordServer[]>;
  createMessageWithRecipients(input: {
    messageValues: Partial<DiscordMessage>;
    recipientValues: Array<Partial<DiscordMessageRecipient>>;
  }): Promise<{ message: DiscordMessage; recipients: DiscordMessageRecipient[] }>;
  createChannelPostMessages(values: Array<Partial<DiscordMessage>>): Promise<DiscordMessage[]>;
}
