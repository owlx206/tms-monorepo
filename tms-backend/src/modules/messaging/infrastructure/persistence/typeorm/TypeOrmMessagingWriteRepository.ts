import { EntityManager, In } from 'typeorm';

import { AppDataSource } from '../../../../../data-source.js';
import { DiscordMessageOrmEntity } from './DiscordMessageOrmEntity.js';
import { DiscordMessageRecipientOrmEntity } from './DiscordMessageRecipientOrmEntity.js';
import { DiscordServerOrmEntity } from './DiscordServerOrmEntity.js';
import { TeacherDiscordChannelCacheOrmEntity } from './TeacherDiscordChannelCacheOrmEntity.js';
import { TeacherDiscordServerCacheOrmEntity } from './TeacherDiscordServerCacheOrmEntity.js';
import { Class } from '../../../../../entities/class.entity.js';
import { Enrollment } from '../../../../../entities/enrollment.entity.js';
import { Student } from '../../../../../entities/student.entity.js';
import type { DiscordMessage } from '../../../../../entities/discord-message.entity.js';
import type { DiscordMessageRecipient } from '../../../../../entities/discord-message-recipient.entity.js';
import type { DiscordServer } from '../../../../../entities/discord-server.entity.js';
import type { TeacherDiscordChannelCache } from '../../../../../entities/teacher-discord-channel-cache.entity.js';
import type { TeacherDiscordServerCache } from '../../../../../entities/teacher-discord-server-cache.entity.js';
import type {
  BulkDmRecipientContext,
  DiscordMembershipSyncStudent,
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
};

type DiscordMembershipSyncStudentRow = {
  student_id: number | string;
  student_name: string;
  discord_username: string | null;
  discord_user_id: string | null;
  discord_access_token: string | null;
  discord_refresh_token: string | null;
  discord_token_expires_at: Date | string | null;
  status: string;
  active_class_id: number | string | null;
  active_class_name: string | null;
  last_class_id: number | string | null;
  last_class_name: string | null;
  class_server_id: number | string | null;
  class_discord_server_id: string | null;
  class_server_name: string | null;
  class_server_bot_token: string | null;
  class_attendance_voice_channel_id: string | null;
  class_notification_channel_id: string | null;
  last_class_server_id: number | string | null;
  last_class_discord_server_id: string | null;
  last_class_server_name: string | null;
  last_class_server_bot_token: string | null;
  last_class_attendance_voice_channel_id: string | null;
  last_class_notification_channel_id: string | null;
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
  return {
    student_id: Number(row.student_id),
    student_name: row.student_name,
    discord_username: row.discord_username,
    active_class_id: row.active_class_id === null ? null : Number(row.active_class_id),
    discord_server: classServer,
  };
}

function toOptionalDiscordServerContext(values: {
  id: number | string | null;
  teacher_id: number;
  class_id: number | string | null;
  discord_server_id: string | null;
  name: string | null;
  bot_token: string | null;
  attendance_voice_channel_id: string | null;
  notification_channel_id: string | null;
}): DiscordServerContext | null {
  if (values.id === null || values.class_id === null || values.discord_server_id === null) {
    return null;
  }

  return toDiscordServerContext({
    id: Number(values.id),
    teacher_id: values.teacher_id,
    class_id: Number(values.class_id),
    discord_server_id: values.discord_server_id,
    name: values.name,
    bot_token: values.bot_token,
    attendance_voice_channel_id: values.attendance_voice_channel_id,
    notification_channel_id: values.notification_channel_id,
  });
}

function toDiscordMembershipSyncStudent(
  row: DiscordMembershipSyncStudentRow,
  teacherId: number,
): DiscordMembershipSyncStudent {
  return {
    student_id: Number(row.student_id),
    student_name: row.student_name,
    discord_username: row.discord_username,
    discord_user_id: row.discord_user_id,
    discord_access_token: row.discord_access_token,
    discord_refresh_token: row.discord_refresh_token,
    discord_token_expires_at: row.discord_token_expires_at === null ? null : new Date(row.discord_token_expires_at),
    status: row.status,
    active_class_id: row.active_class_id === null ? null : Number(row.active_class_id),
    active_class_name: row.active_class_name,
    last_class_id: row.last_class_id === null ? null : Number(row.last_class_id),
    last_class_name: row.last_class_name,
    class_server: toOptionalDiscordServerContext({
      id: row.class_server_id,
      teacher_id: teacherId,
      class_id: row.active_class_id,
      discord_server_id: row.class_discord_server_id,
      name: row.class_server_name,
      bot_token: row.class_server_bot_token,
      attendance_voice_channel_id: row.class_attendance_voice_channel_id,
      notification_channel_id: row.class_notification_channel_id,
    }),
    last_class_server: toOptionalDiscordServerContext({
      id: row.last_class_server_id,
      teacher_id: teacherId,
      class_id: row.last_class_id,
      discord_server_id: row.last_class_discord_server_id,
      name: row.last_class_server_name,
      bot_token: row.last_class_server_bot_token,
      attendance_voice_channel_id: row.last_class_attendance_voice_channel_id,
      notification_channel_id: row.last_class_notification_channel_id,
    }),
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
        const context = toBulkDmRecipientContext(row, teacherId);
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

    return rows.map((row) => toBulkDmRecipientContext(row, teacherId));
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

  async listDiscordMembershipSyncStudents(teacherId: number): Promise<DiscordMembershipSyncStudent[]> {
    const latestEnrollmentSubquery = this.manager.getRepository(Enrollment)
      .createQueryBuilder('latest_enrollment_inner')
      .select('latest_enrollment_inner.id')
      .where('latest_enrollment_inner.teacher_id = student.teacher_id')
      .andWhere('latest_enrollment_inner.student_id = student.id')
      .orderBy('latest_enrollment_inner.enrolled_at', 'DESC')
      .addOrderBy('latest_enrollment_inner.id', 'DESC')
      .limit(1)
      .getQuery();

    const rows = await this.manager.getRepository(Student)
      .createQueryBuilder('student')
      .leftJoin(
        Enrollment,
        'active_enrollment',
        'active_enrollment.student_id = student.id AND active_enrollment.teacher_id = student.teacher_id AND active_enrollment.unenrolled_at IS NULL',
      )
      .leftJoin(
        Class,
        'active_class',
        'active_class.id = active_enrollment.class_id AND active_class.teacher_id = student.teacher_id',
      )
      .leftJoin(
        Enrollment,
        'last_enrollment',
        `last_enrollment.id = (${latestEnrollmentSubquery})`,
      )
      .leftJoin(
        Class,
        'last_class',
        'last_class.id = last_enrollment.class_id AND last_class.teacher_id = student.teacher_id',
      )
      .leftJoin(
        DiscordServerOrmEntity,
        'class_server',
        'class_server.teacher_id = student.teacher_id AND class_server.class_id = active_enrollment.class_id',
      )
      .leftJoin(
        DiscordServerOrmEntity,
        'last_class_server',
        'last_class_server.teacher_id = student.teacher_id AND last_class_server.class_id = last_enrollment.class_id',
      )
      .select('student.id', 'student_id')
      .addSelect('student.full_name', 'student_name')
      .addSelect('student.discord_username', 'discord_username')
      .addSelect('student.discord_user_id', 'discord_user_id')
      .addSelect('student.discord_access_token', 'discord_access_token')
      .addSelect('student.discord_refresh_token', 'discord_refresh_token')
      .addSelect('student.discord_token_expires_at', 'discord_token_expires_at')
      .addSelect('student.status', 'status')
      .addSelect('active_enrollment.class_id', 'active_class_id')
      .addSelect('active_class.name', 'active_class_name')
      .addSelect('last_enrollment.class_id', 'last_class_id')
      .addSelect('last_class.name', 'last_class_name')
      .addSelect('class_server.id', 'class_server_id')
      .addSelect('class_server.discord_server_id', 'class_discord_server_id')
      .addSelect('class_server.name', 'class_server_name')
      .addSelect('class_server.bot_token', 'class_server_bot_token')
      .addSelect('class_server.attendance_voice_channel_id', 'class_attendance_voice_channel_id')
      .addSelect('class_server.notification_channel_id', 'class_notification_channel_id')
      .addSelect('last_class_server.id', 'last_class_server_id')
      .addSelect('last_class_server.discord_server_id', 'last_class_discord_server_id')
      .addSelect('last_class_server.name', 'last_class_server_name')
      .addSelect('last_class_server.bot_token', 'last_class_server_bot_token')
      .addSelect('last_class_server.attendance_voice_channel_id', 'last_class_attendance_voice_channel_id')
      .addSelect('last_class_server.notification_channel_id', 'last_class_notification_channel_id')
      .where('student.teacher_id = :teacherId', { teacherId })
      .orderBy('student.full_name', 'ASC')
      .addOrderBy('student.id', 'ASC')
      .getRawMany<DiscordMembershipSyncStudentRow>();

    return rows.map((row) => toDiscordMembershipSyncStudent(row, teacherId));
  }

  async updateStudentDiscordUserId(teacherId: number, studentId: number, discordUserId: string): Promise<void> {
    await this.manager.getRepository(Student).update(
      { teacher_id: teacherId, id: studentId },
      { discord_user_id: discordUserId },
    );
  }

  async updateStudentDiscordAuthorization(input: {
    teacherId: number;
    studentId: number;
    discordUserId: string;
    discordUsername: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    authorizedAt: Date;
  }): Promise<void> {
    await this.manager.getRepository(Student).update(
      { teacher_id: input.teacherId, id: input.studentId },
      {
        discord_user_id: input.discordUserId,
        discord_username: input.discordUsername,
        discord_access_token: input.accessToken,
        discord_refresh_token: input.refreshToken,
        discord_token_expires_at: input.tokenExpiresAt,
        discord_authorized_at: input.authorizedAt,
      },
    );
  }

  async updateStudentDiscordTokens(input: {
    teacherId: number;
    studentId: number;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
  }): Promise<void> {
    await this.manager.getRepository(Student).update(
      { teacher_id: input.teacherId, id: input.studentId },
      {
        discord_access_token: input.accessToken,
        discord_refresh_token: input.refreshToken,
        discord_token_expires_at: input.tokenExpiresAt,
      },
    );
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
