import { EntityManager, In } from 'typeorm';

import { AppDataSource } from '../../../../../data-source.js';
import { DiscordMessageOrmEntity } from './DiscordMessageOrmEntity.js';
import { DiscordMessageRecipientOrmEntity } from './DiscordMessageRecipientOrmEntity.js';
import { DiscordServerOrmEntity } from './DiscordServerOrmEntity.js';
import { TeacherDiscordChannelCacheOrmEntity } from './TeacherDiscordChannelCacheOrmEntity.js';
import { TeacherDiscordServerCacheOrmEntity } from './TeacherDiscordServerCacheOrmEntity.js';
import { TeacherCommunityServerOrmEntity } from './TeacherCommunityServerOrmEntity.js';
import { Enrollment } from '../../../../../entities/enrollment.entity.js';
import { Student } from '../../../../../entities/student.entity.js';
import type { DiscordMessage } from '../../../../../entities/discord-message.entity.js';
import type { DiscordMessageRecipient } from '../../../../../entities/discord-message-recipient.entity.js';
import type { DiscordServer } from '../../../../../entities/discord-server.entity.js';
import type { TeacherCommunityServer } from '../../../../../entities/teacher-community-server.entity.js';
import type { TeacherDiscordChannelCache } from '../../../../../entities/teacher-discord-channel-cache.entity.js';
import type { TeacherDiscordServerCache } from '../../../../../entities/teacher-discord-server-cache.entity.js';
import type {
  BulkDmRecipientContext,
  MessagingWriteRepository,
} from './MessagingWriteRepository.js';
import type { DiscordServerContext } from '../../../application/ports/DiscordRecipientResolverPort.js';

type BulkDmRecipientRow = {
  student_id: number | string;
  student_name: string;
  discord_username: string | null;
  active_class_id: number | string | null;
  server_id: number | string | null;
  server_class_id: number | string | null;
  discord_server_id: string | null;
  server_name: string | null;
  bot_token: string | null;
  attendance_voice_channel_id: string | null;
  notification_channel_id: string | null;
  community_server_id: number | string | null;
  community_discord_server_id: string | null;
  community_server_name: string | null;
  community_notification_channel_id: string | null;
  community_voice_channel_id: string | null;
};

function toDiscordServerContext(
  values: {
    id: number;
    teacher_id: number;
    class_id: number | null;
    discord_server_id: string;
    name: string | null;
    bot_token: string | null;
    attendance_voice_channel_id: string | null;
    notification_channel_id: string | null;
  },
): DiscordServerContext {
  return values;
}

function toBulkDmRecipientContext(
  row: BulkDmRecipientRow,
  teacherId: number,
  manager: EntityManager,
): BulkDmRecipientContext {
  const serverId = row.server_id === null ? null : Number(row.server_id);
  const serverClassId = row.server_class_id === null ? null : Number(row.server_class_id);
  const classServer = serverId === null || serverClassId === null || row.discord_server_id === null
    ? null
    : toDiscordServerContext({
      id: serverId,
      teacher_id: teacherId,
      class_id: serverClassId,
      discord_server_id: row.discord_server_id,
      name: row.server_name,
      bot_token: row.bot_token,
      attendance_voice_channel_id: row.attendance_voice_channel_id,
      notification_channel_id: row.notification_channel_id,
    });
  const communityServerId = row.community_server_id === null ? null : Number(row.community_server_id);
  const communityServer = communityServerId === null || row.community_discord_server_id === null
    ? null
    : toDiscordServerContext({
      id: communityServerId,
      teacher_id: teacherId,
      class_id: null,
      discord_server_id: row.community_discord_server_id,
      name: row.community_server_name,
      bot_token: null,
      attendance_voice_channel_id: null,
      notification_channel_id: row.community_notification_channel_id,
    });

  return {
    student_id: Number(row.student_id),
    student_name: row.student_name,
    discord_username: row.discord_username,
    active_class_id: row.active_class_id === null ? null : Number(row.active_class_id),
    discord_server: communityServer ?? classServer,
  };
}

function bulkDmRecipientQuery(manager: EntityManager, teacherId: number) {
  return manager.getRepository(Student)
    .createQueryBuilder('student')
    .leftJoin(
      Enrollment,
      'active_enrollment',
      'active_enrollment.student_id = student.id AND active_enrollment.teacher_id = student.teacher_id AND active_enrollment.unenrolled_at IS NULL',
    )
    .leftJoin(
      DiscordServerOrmEntity,
      'discord_server',
      'discord_server.teacher_id = student.teacher_id AND discord_server.class_id = active_enrollment.class_id',
    )
    .leftJoin(
      TeacherCommunityServerOrmEntity,
      'community_server',
      'community_server.teacher_id = student.teacher_id',
    )
    .select('student.id', 'student_id')
    .addSelect('student.full_name', 'student_name')
    .addSelect('student.discord_username', 'discord_username')
    .addSelect('active_enrollment.class_id', 'active_class_id')
    .addSelect('discord_server.id', 'server_id')
    .addSelect('discord_server.class_id', 'server_class_id')
    .addSelect('discord_server.discord_server_id', 'discord_server_id')
    .addSelect('discord_server.name', 'server_name')
    .addSelect('discord_server.bot_token', 'bot_token')
    .addSelect('discord_server.attendance_voice_channel_id', 'attendance_voice_channel_id')
    .addSelect('discord_server.notification_channel_id', 'notification_channel_id')
    .addSelect('community_server.id', 'community_server_id')
    .addSelect('community_server.discord_server_id', 'community_discord_server_id')
    .addSelect('community_server.name', 'community_server_name')
    .addSelect('community_server.notification_channel_id', 'community_notification_channel_id')
    .addSelect('community_server.voice_channel_id', 'community_voice_channel_id')
    .where('student.teacher_id = :teacherId', { teacherId });
}

export class TypeOrmMessagingWriteRepository implements MessagingWriteRepository {
  constructor(private readonly manager: EntityManager = AppDataSource.manager) {}

  findDiscordServerByClass(teacherId: number, classId: number) {
    return this.manager.getRepository(DiscordServerOrmEntity).findOneBy({
      teacher_id: teacherId,
      class_id: classId,
    });
  }

  removeDiscordServer(server: DiscordServer) {
    return this.manager.getRepository(DiscordServerOrmEntity).remove(server);
  }

  createDiscordServer(values: Partial<DiscordServer>) {
    return this.manager.getRepository(DiscordServerOrmEntity).create(values);
  }

  saveDiscordServer(server: DiscordServer) {
    return this.manager.getRepository(DiscordServerOrmEntity).save(server);
  }

  findCommunityServerByTeacher(teacherId: number) {
    return this.manager.getRepository(TeacherCommunityServerOrmEntity).findOneBy({
      teacher_id: teacherId,
    });
  }

  createCommunityServer(values: Partial<TeacherCommunityServer>) {
    return this.manager.getRepository(TeacherCommunityServerOrmEntity).create(values);
  }

  saveCommunityServer(server: TeacherCommunityServer) {
    return this.manager.getRepository(TeacherCommunityServerOrmEntity).save(server);
  }

  removeCommunityServer(server: TeacherCommunityServer) {
    return this.manager.getRepository(TeacherCommunityServerOrmEntity).remove(server);
  }

  async replaceTeacherDiscordServerCaches(
    teacherId: number,
    servers: Array<{ discord_server_id: string; name: string }>,
  ): Promise<TeacherDiscordServerCache[]> {
    const repo = this.manager.getRepository(TeacherDiscordServerCacheOrmEntity);
    await repo.delete({ teacher_id: teacherId });
    if (servers.length === 0) {
      return [];
    }

    return repo.save(servers.map((server) => repo.create({
      teacher_id: teacherId,
      discord_server_id: server.discord_server_id,
      name: server.name,
      synced_at: new Date(),
    })));
  }

  listTeacherDiscordServerCaches(teacherId: number) {
    return this.manager.getRepository(TeacherDiscordServerCacheOrmEntity).find({
      where: { teacher_id: teacherId },
      order: { name: 'ASC' },
    });
  }

  findTeacherDiscordServerCacheByDiscordServerId(teacherId: number, discordServerId: string) {
    return this.manager.getRepository(TeacherDiscordServerCacheOrmEntity).findOneBy({
      teacher_id: teacherId,
      discord_server_id: discordServerId,
    });
  }

  findAnyTeacherDiscordServerCacheByDiscordServerId(discordServerId: string) {
    return this.manager.getRepository(TeacherDiscordServerCacheOrmEntity).findOneBy({
      discord_server_id: discordServerId,
    });
  }

  createTeacherDiscordServerCache(values: Partial<TeacherDiscordServerCache>) {
    return this.manager.getRepository(TeacherDiscordServerCacheOrmEntity).create(values);
  }

  saveTeacherDiscordServerCache(server: TeacherDiscordServerCache) {
    return this.manager.getRepository(TeacherDiscordServerCacheOrmEntity).save(server);
  }

  async replaceTeacherDiscordChannelCaches(
    teacherId: number,
    discordServerId: string,
    channels: Array<{ discord_channel_id: string; name: string; type: 'text' | 'voice' }>,
  ): Promise<TeacherDiscordChannelCache[]> {
    const repo = this.manager.getRepository(TeacherDiscordChannelCacheOrmEntity);
    await repo.delete({
      teacher_id: teacherId,
      discord_server_id: discordServerId,
    });

    if (channels.length === 0) {
      return [];
    }

    return repo.save(channels.map((channel) => repo.create({
      teacher_id: teacherId,
      discord_server_id: discordServerId,
      discord_channel_id: channel.discord_channel_id,
      name: channel.name,
      type: channel.type,
      synced_at: new Date(),
    })));
  }

  findTeacherDiscordServerCacheById(teacherId: number, serverCacheId: number) {
    return this.manager.getRepository(TeacherDiscordServerCacheOrmEntity).findOneBy({
      teacher_id: teacherId,
      id: serverCacheId,
    });
  }

  findTeacherDiscordChannelCacheById(teacherId: number, channelCacheId: number) {
    return this.manager.getRepository(TeacherDiscordChannelCacheOrmEntity).findOneBy({
      teacher_id: teacherId,
      id: channelCacheId,
    });
  }

  async hasCommunityServerByDiscordServerId(teacherId: number, discordServerId: string): Promise<boolean> {
    const count = await this.manager.getRepository(TeacherCommunityServerOrmEntity).countBy({
      teacher_id: teacherId,
      discord_server_id: discordServerId,
    });

    return count > 0;
  }

  findDiscordServerByDiscordServerId(teacherId: number, discordServerId: string) {
    return this.manager.getRepository(DiscordServerOrmEntity).findOneBy({
      teacher_id: teacherId,
      discord_server_id: discordServerId,
    });
  }

  async listBulkDmRecipientContextsByStudentIds(teacherId: number, studentIds: number[]) {
    if (studentIds.length === 0) {
      return [];
    }

    const rows = await bulkDmRecipientQuery(this.manager, teacherId)
      .andWhere('student.id IN (:...studentIds)', { studentIds })
      .getRawMany<BulkDmRecipientRow>();
    const contextByStudentId = new Map(
      rows.map((row) => {
        const context = toBulkDmRecipientContext(row, teacherId, this.manager);
        return [context.student_id, context];
      }),
    );

    return studentIds
      .map((studentId) => contextByStudentId.get(studentId))
      .filter((context): context is BulkDmRecipientContext => context !== undefined);
  }

  async listBulkDmRecipientContextsByClass(teacherId: number, classId: number) {
    const rows = await bulkDmRecipientQuery(this.manager, teacherId)
      .innerJoin(
        Enrollment,
        'class_enrollment',
        'class_enrollment.student_id = student.id AND class_enrollment.teacher_id = student.teacher_id AND class_enrollment.class_id = :classId AND class_enrollment.unenrolled_at IS NULL',
        { classId },
      )
      .orderBy('student.full_name', 'ASC')
      .addOrderBy('student.id', 'ASC')
      .getRawMany<BulkDmRecipientRow>();

    return rows.map((row) => toBulkDmRecipientContext(row, teacherId, this.manager));
  }

  findDiscordServersByIds(teacherId: number, serverIds: number[]) {
    if (serverIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.manager.getRepository(DiscordServerOrmEntity).findBy({
      teacher_id: teacherId,
      id: In(serverIds),
    });
  }

  createMessageWithRecipients(input: {
    messageValues: Partial<DiscordMessage>;
    recipientValues: Array<Partial<DiscordMessageRecipient>>;
  }) {
    return AppDataSource.transaction(async (transactionManager) => {
      const messageRepo = transactionManager.getRepository(DiscordMessageOrmEntity);
      const recipientRepo = transactionManager.getRepository(DiscordMessageRecipientOrmEntity);
      const message = await messageRepo.save(messageRepo.create(input.messageValues));
      const recipients = input.recipientValues.map((recipient) => recipientRepo.create({
        ...recipient,
        discord_message_id: message.id,
      }));
      await recipientRepo.save(recipients);
      return { message, recipients };
    });
  }

  createChannelPostMessages(values: Array<Partial<DiscordMessage>>) {
    return AppDataSource.transaction(async (transactionManager) => {
      const messageRepo = transactionManager.getRepository(DiscordMessageOrmEntity);
      return messageRepo.save(values.map((value) => messageRepo.create(value)));
    });
  }
}
