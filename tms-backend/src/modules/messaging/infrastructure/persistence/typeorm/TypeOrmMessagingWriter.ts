import { EntityManager, In } from 'typeorm';

import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { DiscordServer } from '../../../../../entities/discord-server.entity.js';
import { DiscordServerChannel } from '../../../../../entities/discord-server-channel.entity.js';
import { DiscordServerOwnership } from '../../../../../entities/discord-server-ownership.entity.js';
import { Class } from '../../../../../entities/class.entity.js';
import { Enrollment } from '../../../../../entities/enrollment.entity.js';
import { Student } from '../../../../../entities/student.entity.js';
import { Teacher } from '../../../../../entities/teacher.entity.js';
import type { DiscordServerContext } from '../../discord/discord.types.js';

export type StudentMessageRecipientContext = {
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

type StudentMessageRecipientRow = {
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

function toStudentMessageRecipientContext(
  row: StudentMessageRecipientRow,
  teacherId: number,
): StudentMessageRecipientContext {
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

function studentMessageRecipientQuery(manager: EntityManager, teacherId: number) {
  return manager.getRepository(Student)
    .createQueryBuilder('student')
    .leftJoin(
      Enrollment,
      'active_enrollment',
      'active_enrollment.student_id = student.id AND active_enrollment.teacher_id = student.teacher_id AND active_enrollment.unenrolled_at IS NULL',
    )
    .leftJoin(
      DiscordServer,
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

export class TypeOrmMessagingWriter {
  constructor(private readonly manager: EntityManager = AppDataSource.manager) {}

  async getTeacherDiscordUserId(teacherId: number): Promise<string | null> {
    const teacher = await this.manager.getRepository(Teacher).findOne({
      where: { id: teacherId },
      select: { id: true, discord_user_id: true },
    });

    return teacher?.discord_user_id ?? null;
  }

  findDiscordServerByClass(teacherId: number, classId: number) {
    return this.manager.getRepository(DiscordServer).findOneBy({
      teacher_id: teacherId,
      class_id: classId,
    });
  }

  removeDiscordServer(server: DiscordServer) {
    return this.manager.getRepository(DiscordServer).remove(server);
  }

  createDiscordServer(values: Partial<DiscordServer>) {
    return this.manager.getRepository(DiscordServer).create(values);
  }

  saveDiscordServer(server: DiscordServer) {
    return this.manager.getRepository(DiscordServer).save(server);
  }

  async listKnownTeacherDiscordServerIds(teacherId: number): Promise<string[]> {
    const discordUserId = await this.getTeacherDiscordUserId(teacherId);
    const [ownedServers, boundServers] = await Promise.all([
      discordUserId
        ? this.manager.getRepository(DiscordServerOwnership).find({
          where: { discord_user_id: discordUserId },
          select: { discord_server_id: true },
        })
        : Promise.resolve([]),
      this.manager.getRepository(DiscordServer).find({
        where: { teacher_id: teacherId },
        select: { discord_server_id: true },
      }),
    ]);

    return Array.from(new Set(
      [...ownedServers, ...boundServers]
        .map((server) => server.discord_server_id.trim())
        .filter((discordServerId) => discordServerId.length > 0),
    ));
  }

  async replaceDiscordServerOwnerships(
    discordUserId: string,
    servers: Array<{ discord_server_id: string; name: string }>,
  ): Promise<DiscordServerOwnership[]> {
    const repo = this.manager.getRepository(DiscordServerOwnership);
    await repo.delete({ discord_user_id: discordUserId });
    if (servers.length === 0) {
      return [];
    }

    return repo.save(servers.map((server) => repo.create({
      discord_user_id: discordUserId,
      discord_server_id: server.discord_server_id,
      name: server.name,
      synced_at: new Date(),
    })));
  }

  async pruneDiscordDataForMissingServers(
    teacherId: number,
    discordUserId: string,
    syncedDiscordServerIds: string[],
  ) {
    const normalizedIds = Array.from(new Set(
      syncedDiscordServerIds.map((id) => id.trim()).filter((id) => id.length > 0),
    ));

    const serverBindingQuery = this.manager.getRepository(DiscordServer)
      .createQueryBuilder()
      .delete()
      .from(DiscordServer)
      .where('teacher_id = :teacherId', { teacherId });

    const channelQuery = this.manager.getRepository(DiscordServerChannel)
      .createQueryBuilder()
      .delete()
      .from(DiscordServerChannel)
      .where('discord_user_id = :discordUserId', { discordUserId });

    if (normalizedIds.length > 0) {
      serverBindingQuery.andWhere('discord_server_id NOT IN (:...discordServerIds)', {
        discordServerIds: normalizedIds,
      });
      channelQuery.andWhere('discord_server_id NOT IN (:...discordServerIds)', {
        discordServerIds: normalizedIds,
      });
    }

    const [serverBindings, channels] = await Promise.all([
      serverBindingQuery.execute(),
      channelQuery.execute(),
    ]);

    return {
      removed_server_bindings: serverBindings.affected ?? 0,
      removed_channels: channels.affected ?? 0,
    };
  }

  listDiscordServerOwnerships(discordUserId: string) {
    return this.manager.getRepository(DiscordServerOwnership).find({
      where: { discord_user_id: discordUserId },
      order: { name: 'ASC' },
    });
  }

  findDiscordServerOwnershipByDiscordServerId(discordUserId: string, discordServerId: string) {
    return this.manager.getRepository(DiscordServerOwnership).findOneBy({
      discord_user_id: discordUserId,
      discord_server_id: discordServerId,
    });
  }

  findAnyDiscordServerOwnershipByDiscordServerId(discordServerId: string) {
    return this.manager.getRepository(DiscordServerOwnership).findOneBy({
      discord_server_id: discordServerId,
    });
  }

  createDiscordServerOwnership(values: Partial<DiscordServerOwnership>) {
    return this.manager.getRepository(DiscordServerOwnership).create(values);
  }

  saveDiscordServerOwnership(server: DiscordServerOwnership) {
    return this.manager.getRepository(DiscordServerOwnership).save(server);
  }

  async replaceDiscordServerChannels(
    discordUserId: string,
    discordServerId: string,
    channels: Array<{ discord_channel_id: string; name: string; type: 'text' | 'voice' }>,
  ): Promise<DiscordServerChannel[]> {
    const repo = this.manager.getRepository(DiscordServerChannel);
    await repo.delete({
      discord_user_id: discordUserId,
      discord_server_id: discordServerId,
    });

    if (channels.length === 0) {
      return [];
    }

    return repo.save(channels.map((channel) => repo.create({
      discord_user_id: discordUserId,
      discord_server_id: discordServerId,
      discord_channel_id: channel.discord_channel_id,
      name: channel.name,
      type: channel.type,
      synced_at: new Date(),
    })));
  }

  async findDiscordServerOwnershipById(teacherId: number, serverOwnershipId: number) {
    const discordUserId = await this.getTeacherDiscordUserId(teacherId);
    if (!discordUserId) {
      return null;
    }

    return this.manager.getRepository(DiscordServerOwnership).findOneBy({
      discord_user_id: discordUserId,
      id: serverOwnershipId,
    });
  }

  async findDiscordServerChannelById(teacherId: number, channelId: number) {
    const discordUserId = await this.getTeacherDiscordUserId(teacherId);
    if (!discordUserId) {
      return null;
    }

    return this.manager.getRepository(DiscordServerChannel).findOneBy({
      discord_user_id: discordUserId,
      id: channelId,
    });
  }

  findDiscordServerByDiscordServerId(teacherId: number, discordServerId: string) {
    return this.manager.getRepository(DiscordServer).findOneBy({
      teacher_id: teacherId,
      discord_server_id: discordServerId,
    });
  }

  async listStudentMessageRecipientContextsByStudentIds(teacherId: number, studentIds: number[]) {
    if (studentIds.length === 0) {
      return [];
    }

    const rows = await studentMessageRecipientQuery(this.manager, teacherId)
      .andWhere('student.id IN (:...studentIds)', { studentIds })
      .getRawMany<StudentMessageRecipientRow>();
    const contextByStudentId = new Map(
      rows.map((row) => {
        const context = toStudentMessageRecipientContext(row, teacherId);
        return [context.student_id, context];
      }),
    );

    return studentIds
      .map((studentId) => contextByStudentId.get(studentId))
      .filter((context): context is StudentMessageRecipientContext => context !== undefined);
  }

  async listStudentMessageRecipientContextsByClass(teacherId: number, classId: number) {
    const rows = await studentMessageRecipientQuery(this.manager, teacherId)
      .innerJoin(
        Enrollment,
        'class_enrollment',
        'class_enrollment.student_id = student.id AND class_enrollment.teacher_id = student.teacher_id AND class_enrollment.class_id = :classId AND class_enrollment.unenrolled_at IS NULL',
        { classId },
      )
      .orderBy('student.full_name', 'ASC')
      .addOrderBy('student.id', 'ASC')
      .getRawMany<StudentMessageRecipientRow>();

    return rows.map((row) => toStudentMessageRecipientContext(row, teacherId));
  }

  findDiscordServersByIds(teacherId: number, serverIds: number[]) {
    if (serverIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.manager.getRepository(DiscordServer).findBy({
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
        DiscordServer,
        'class_server',
        'class_server.teacher_id = student.teacher_id AND class_server.class_id = active_enrollment.class_id',
      )
      .leftJoin(
        DiscordServer,
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

}
