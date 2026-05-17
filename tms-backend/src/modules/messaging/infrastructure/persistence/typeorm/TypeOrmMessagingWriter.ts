import { EntityManager, In } from 'typeorm';

import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { ClassDiscordBinding } from '../../../../../entities/class-guild.entity.js';
import { DiscordGuildChannelCache } from '../../../../../entities/discord-channel.entity.js';
import { DiscordUserGuild } from '../../../../../entities/discord-guild.entity.js';
import { Class } from '../../../../../entities/class.entity.js';
import { Enrollment } from '../../../../../entities/enrollment.entity.js';
import { Student } from '../../../../../entities/student.entity.js';
import { Teacher } from '../../../../../entities/teacher.entity.js';
import type { ClassDiscordBindingContext } from '../../discord/discord.types.js';

export type StudentMessageRecipientContext = {
  student_id: number;
  student_name: string;
  discord_username: string | null;
  active_class_id: number | null;
  discord_guild: ClassDiscordBindingContext | null;
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
  class_guild: ClassDiscordBindingContext | null;
  last_class_guild: ClassDiscordBindingContext | null;
};

type StudentMessageRecipientRow = {
  student_id: number | string;
  student_name: string;
  discord_username: string | null;
  active_class_id: number | string | null;
  guild_id: number | string | null;
  guild_class_id: number | string | null;
  discord_guild_id: string | null;
  guild_name: string | null;
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
  class_guild_id: number | string | null;
  class_discord_guild_id: string | null;
  class_guild_name: string | null;
  class_guild_bot_token: string | null;
  class_attendance_voice_channel_id: string | null;
  class_notification_channel_id: string | null;
  last_class_guild_id: number | string | null;
  last_class_discord_guild_id: string | null;
  last_class_guild_name: string | null;
  last_class_guild_bot_token: string | null;
  last_class_attendance_voice_channel_id: string | null;
  last_class_notification_channel_id: string | null;
};

function toClassDiscordBindingContext(
  values: {
    id: number;
    teacher_id: number;
    class_id: number | null;
    discord_guild_id: string;
    name: string | null;
    bot_token: string | null;
    attendance_voice_channel_id: string | null;
    notification_channel_id: string | null;
  },
): ClassDiscordBindingContext {
  return values;
}

function toStudentMessageRecipientContext(
  row: StudentMessageRecipientRow,
  teacherId: number,
): StudentMessageRecipientContext {
  const guildId = row.guild_id === null ? null : Number(row.guild_id);
  const guildClassId = row.guild_class_id === null ? null : Number(row.guild_class_id);
  const classGuild = guildId === null || guildClassId === null || row.discord_guild_id === null
    ? null
    : toClassDiscordBindingContext({
      id: guildId,
      teacher_id: teacherId,
      class_id: guildClassId,
      discord_guild_id: row.discord_guild_id,
      name: row.guild_name,
      bot_token: row.bot_token,
      attendance_voice_channel_id: row.attendance_voice_channel_id,
      notification_channel_id: row.notification_channel_id,
    });
  return {
    student_id: Number(row.student_id),
    student_name: row.student_name,
    discord_username: row.discord_username,
    active_class_id: row.active_class_id === null ? null : Number(row.active_class_id),
    discord_guild: classGuild,
  };
}

function toOptionalClassDiscordBindingContext(values: {
  id: number | string | null;
  teacher_id: number;
  class_id: number | string | null;
  discord_guild_id: string | null;
  name: string | null;
  bot_token: string | null;
  attendance_voice_channel_id: string | null;
  notification_channel_id: string | null;
}): ClassDiscordBindingContext | null {
  if (values.id === null || values.class_id === null || values.discord_guild_id === null) {
    return null;
  }

  return toClassDiscordBindingContext({
    id: Number(values.id),
    teacher_id: values.teacher_id,
    class_id: Number(values.class_id),
    discord_guild_id: values.discord_guild_id,
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
    class_guild: toOptionalClassDiscordBindingContext({
      id: row.class_guild_id,
      teacher_id: teacherId,
      class_id: row.active_class_id,
      discord_guild_id: row.class_discord_guild_id,
      name: row.class_guild_name,
      bot_token: row.class_guild_bot_token,
      attendance_voice_channel_id: row.class_attendance_voice_channel_id,
      notification_channel_id: row.class_notification_channel_id,
    }),
    last_class_guild: toOptionalClassDiscordBindingContext({
      id: row.last_class_guild_id,
      teacher_id: teacherId,
      class_id: row.last_class_id,
      discord_guild_id: row.last_class_discord_guild_id,
      name: row.last_class_guild_name,
      bot_token: row.last_class_guild_bot_token,
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
      ClassDiscordBinding,
      'discord_guild',
      'discord_guild.teacher_id = student.teacher_id AND discord_guild.class_id = active_enrollment.class_id',
    )
    .select('student.id', 'student_id')
    .addSelect('student.full_name', 'student_name')
    .addSelect('student.discord_username', 'discord_username')
    .addSelect('active_enrollment.class_id', 'active_class_id')
    .addSelect('discord_guild.id', 'guild_id')
    .addSelect('discord_guild.class_id', 'guild_class_id')
    .addSelect('discord_guild.discord_guild_id', 'discord_guild_id')
    .addSelect('discord_guild.name', 'guild_name')
    .addSelect('discord_guild.bot_token', 'bot_token')
    .addSelect('discord_guild.attendance_voice_channel_id', 'attendance_voice_channel_id')
    .addSelect('discord_guild.notification_channel_id', 'notification_channel_id')
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

  findDiscordGuildByClass(teacherId: number, classId: number) {
    return this.manager.getRepository(ClassDiscordBinding).findOneBy({
      teacher_id: teacherId,
      class_id: classId,
    });
  }

  removeClassDiscordBinding(binding: ClassDiscordBinding) {
    return this.manager.getRepository(ClassDiscordBinding).remove(binding);
  }

  createClassDiscordBinding(values: Partial<ClassDiscordBinding>) {
    return this.manager.getRepository(ClassDiscordBinding).create(values);
  }

  saveClassDiscordBinding(binding: ClassDiscordBinding) {
    return this.manager.getRepository(ClassDiscordBinding).save(binding);
  }

  async listKnownTeacherDiscordGuildIds(teacherId: number): Promise<string[]> {
    const discordUserId = await this.getTeacherDiscordUserId(teacherId);
    const [ownedGuilds, boundGuilds] = await Promise.all([
      discordUserId
        ? this.manager.getRepository(DiscordUserGuild).find({
          where: { discord_user_id: discordUserId },
          select: { discord_guild_id: true },
        })
        : Promise.resolve([]),
      this.manager.getRepository(ClassDiscordBinding).find({
        where: { teacher_id: teacherId },
        select: { discord_guild_id: true },
      }),
    ]);

    return Array.from(new Set(
      [...ownedGuilds, ...boundGuilds]
        .map((guild) => guild.discord_guild_id.trim())
        .filter((discordGuildId) => discordGuildId.length > 0),
    ));
  }

  async replaceDiscordUserGuilds(
    discordUserId: string,
    guilds: Array<{ discord_guild_id: string; name: string }>,
  ): Promise<DiscordUserGuild[]> {
    const repo = this.manager.getRepository(DiscordUserGuild);
    await repo.delete({ discord_user_id: discordUserId });
    if (guilds.length === 0) {
      return [];
    }

    return repo.save(guilds.map((guild) => repo.create({
      discord_user_id: discordUserId,
      discord_guild_id: guild.discord_guild_id,
      name: guild.name,
      synced_at: new Date(),
    })));
  }

  async pruneDiscordDataForMissingGuilds(
    teacherId: number,
    discordUserId: string,
    syncedDiscordGuildIds: string[],
  ) {
    const normalizedIds = Array.from(new Set(
      syncedDiscordGuildIds.map((id) => id.trim()).filter((id) => id.length > 0),
    ));

    const guildBindingQuery = this.manager.getRepository(ClassDiscordBinding)
      .createQueryBuilder()
      .delete()
      .from(ClassDiscordBinding)
      .where('teacher_id = :teacherId', { teacherId });

    const channelQuery = this.manager.getRepository(DiscordGuildChannelCache)
      .createQueryBuilder()
      .delete()
      .from(DiscordGuildChannelCache)
      .where('discord_user_id = :discordUserId', { discordUserId });

    if (normalizedIds.length > 0) {
      guildBindingQuery.andWhere('discord_guild_id NOT IN (:...discordGuildIds)', {
        discordGuildIds: normalizedIds,
      });
      channelQuery.andWhere('discord_guild_id NOT IN (:...discordGuildIds)', {
        discordGuildIds: normalizedIds,
      });
    }

    const [guildBindings, channels] = await Promise.all([
      guildBindingQuery.execute(),
      channelQuery.execute(),
    ]);

    return {
      removed_guild_bindings: guildBindings.affected ?? 0,
      removed_channels: channels.affected ?? 0,
    };
  }

  listDiscordUserGuilds(discordUserId: string) {
    return this.manager.getRepository(DiscordUserGuild).find({
      where: { discord_user_id: discordUserId },
      order: { name: 'ASC' },
    });
  }

  findDiscordUserGuildByDiscordGuildId(discordUserId: string, discordGuildId: string) {
    return this.manager.getRepository(DiscordUserGuild).findOneBy({
      discord_user_id: discordUserId,
      discord_guild_id: discordGuildId,
    });
  }

  findAnyDiscordUserGuildByDiscordGuildId(discordGuildId: string) {
    return this.manager.getRepository(DiscordUserGuild).findOneBy({
      discord_guild_id: discordGuildId,
    });
  }

  createDiscordUserGuild(values: Partial<DiscordUserGuild>) {
    return this.manager.getRepository(DiscordUserGuild).create(values);
  }

  saveDiscordUserGuild(userGuild: DiscordUserGuild) {
    return this.manager.getRepository(DiscordUserGuild).save(userGuild);
  }

  async replaceDiscordGuildChannelCaches(
    discordUserId: string,
    discordGuildId: string,
    channels: Array<{ discord_channel_id: string; name: string; type: 'text' | 'voice' }>,
  ): Promise<DiscordGuildChannelCache[]> {
    const repo = this.manager.getRepository(DiscordGuildChannelCache);
    await repo.delete({
      discord_user_id: discordUserId,
      discord_guild_id: discordGuildId,
    });

    if (channels.length === 0) {
      return [];
    }

    return repo.save(channels.map((channel) => repo.create({
      discord_user_id: discordUserId,
      discord_guild_id: discordGuildId,
      discord_channel_id: channel.discord_channel_id,
      name: channel.name,
      type: channel.type,
      synced_at: new Date(),
    })));
  }

  async findDiscordUserGuildById(teacherId: number, userGuildId: number) {
    const discordUserId = await this.getTeacherDiscordUserId(teacherId);
    if (!discordUserId) {
      return null;
    }

    return this.manager.getRepository(DiscordUserGuild).findOneBy({
      discord_user_id: discordUserId,
      id: userGuildId,
    });
  }

  async findDiscordGuildChannelCacheById(teacherId: number, channelId: number) {
    const discordUserId = await this.getTeacherDiscordUserId(teacherId);
    if (!discordUserId) {
      return null;
    }

    return this.manager.getRepository(DiscordGuildChannelCache).findOneBy({
      discord_user_id: discordUserId,
      id: channelId,
    });
  }

  findDiscordGuildByDiscordGuildId(teacherId: number, discordGuildId: string) {
    return this.manager.getRepository(ClassDiscordBinding).findOneBy({
      teacher_id: teacherId,
      discord_guild_id: discordGuildId,
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

  findDiscordGuildsByIds(teacherId: number, guildIds: number[]) {
    if (guildIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.manager.getRepository(ClassDiscordBinding).findBy({
      teacher_id: teacherId,
      id: In(guildIds),
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
        ClassDiscordBinding,
        'class_guild',
        'class_guild.teacher_id = student.teacher_id AND class_guild.class_id = active_enrollment.class_id',
      )
      .leftJoin(
        ClassDiscordBinding,
        'last_class_guild',
        'last_class_guild.teacher_id = student.teacher_id AND last_class_guild.class_id = last_enrollment.class_id',
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
      .addSelect('class_guild.id', 'class_guild_id')
      .addSelect('class_guild.discord_guild_id', 'class_discord_guild_id')
      .addSelect('class_guild.name', 'class_guild_name')
      .addSelect('class_guild.bot_token', 'class_guild_bot_token')
      .addSelect('class_guild.attendance_voice_channel_id', 'class_attendance_voice_channel_id')
      .addSelect('class_guild.notification_channel_id', 'class_notification_channel_id')
      .addSelect('last_class_guild.id', 'last_class_guild_id')
      .addSelect('last_class_guild.discord_guild_id', 'last_class_discord_guild_id')
      .addSelect('last_class_guild.name', 'last_class_guild_name')
      .addSelect('last_class_guild.bot_token', 'last_class_guild_bot_token')
      .addSelect('last_class_guild.attendance_voice_channel_id', 'last_class_attendance_voice_channel_id')
      .addSelect('last_class_guild.notification_channel_id', 'last_class_notification_channel_id')
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
