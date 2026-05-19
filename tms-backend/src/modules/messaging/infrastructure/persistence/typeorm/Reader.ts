import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { ClassStatus } from '../../../../classroom/contracts/types.js';
import { StudentStatus } from '../../../../enrollment/contracts/types.js';
import { Class } from '../../../../classroom/infrastructure/persistence/typeorm/entities/class.entity.js';
import { Student } from '../../../../enrollment/infrastructure/persistence/typeorm/entities/student.entity.js';
import { ClassDiscordBinding } from './entities/class-discord-binding.entity.js';
import { DiscordGuildChannelCache } from './entities/discord-guild-channel-cache.entity.js';
import { DiscordUserGuild } from './entities/discord-user-guild.entity.js';
import { Teacher } from '../../../../identity/infrastructure/persistence/typeorm/entities/teacher.entity.js';

// TypeOrmMessagingReader.ts
export class TypeOrmMessagingReader {
  private async getTeacherDiscordUserId(teacherId: number): Promise<string | null> {
    const teacher = await AppDataSource.getRepository(Teacher).findOne({
      where: { id: teacherId },
      select: { id: true, discord_user_id: true },
    });

    return teacher?.discord_user_id ?? null;
  }

  async listDiscordGuildsForTeacher(teacherId: number) {
    return AppDataSource.getRepository(ClassDiscordBinding).find({
      where: { teacher_id: teacherId },
      order: { id: 'DESC' },
    });
  }

  async listTeacherDiscordGuilds(teacherId: number) {
    const discordUserId = await this.getTeacherDiscordUserId(teacherId);
    if (!discordUserId) {
      return [];
    }

    return AppDataSource.getRepository(DiscordUserGuild)
      .createQueryBuilder('user_guild')
      .leftJoin(
        ClassDiscordBinding,
        'class_binding',
        'class_binding.teacher_id = :teacherId AND class_binding.discord_guild_id = user_guild.discord_guild_id',
      )
      .leftJoin(
        Class,
        'class',
        'class.id = class_binding.class_id AND class.teacher_id = class_binding.teacher_id',
      )
      .leftJoin(
        DiscordGuildChannelCache,
        'notification_channel',
        'notification_channel.discord_user_id = user_guild.discord_user_id AND notification_channel.discord_guild_id = class_binding.discord_guild_id AND notification_channel.discord_channel_id = class_binding.notification_channel_id',
      )
      .leftJoin(
        DiscordGuildChannelCache,
        'voice_channel',
        'voice_channel.discord_user_id = user_guild.discord_user_id AND voice_channel.discord_guild_id = class_binding.discord_guild_id AND voice_channel.discord_channel_id = class_binding.attendance_voice_channel_id',
      )
      .select('user_guild.id', 'id')
      .addSelect('user_guild.discord_guild_id', 'discord_guild_id')
      .addSelect('user_guild.name', 'name')
      .addSelect('user_guild.synced_at', 'synced_at')
      .addSelect(`
        CASE
          WHEN class_binding.id IS NOT NULL THEN 'class'
          ELSE 'unbound'
        END
      `, 'binding_role')
      .addSelect('class_binding.id', 'binding_guild_id')
      .addSelect('class_binding.class_id', 'binding_class_id')
      .addSelect('class.name', 'binding_class_name')
      .addSelect('class_binding.notification_channel_id', 'binding_notification_channel_id')
      .addSelect('notification_channel.name', 'binding_notification_channel_name')
      .addSelect('notification_channel.id', 'binding_notification_channel_id_ref')
      .addSelect('class_binding.attendance_voice_channel_id', 'binding_attendance_voice_channel_id')
      .addSelect('voice_channel.name', 'binding_attendance_voice_channel_name')
      .addSelect('voice_channel.id', 'binding_attendance_voice_channel_id_ref')
      .where('user_guild.discord_user_id = :discordUserId', { teacherId, discordUserId })
      .orderBy('user_guild.name', 'ASC')
      .getRawMany<{
        id: string;
        discord_guild_id: string;
        name: string;
        synced_at: string | Date;
        binding_guild_id: string | null;
        binding_role: 'unbound' | 'class';
        binding_class_id: string | null;
        binding_class_name: string | null;
        binding_notification_channel_id: string | null;
        binding_notification_channel_name: string | null;
        binding_notification_channel_id_ref: string | null;
        binding_attendance_voice_channel_id: string | null;
        binding_attendance_voice_channel_name: string | null;
        binding_attendance_voice_channel_id_ref: string | null;
      }>()
      .then((rows) => rows.map((row) => ({
        id: Number(row.id),
        teacher_id: teacherId,
        discord_guild_id: row.discord_guild_id,
        name: row.name,
        synced_at: new Date(row.synced_at),
        binding_guild_id: row.binding_guild_id === null ? null : Number(row.binding_guild_id),
        binding_role: row.binding_role,
        binding_class_id: row.binding_class_id === null ? null : Number(row.binding_class_id),
        binding_class_name: row.binding_class_name,
        binding_notification_channel_id: row.binding_notification_channel_id,
        binding_notification_channel_name: row.binding_notification_channel_name,
        binding_notification_channel_cache_id: row.binding_notification_channel_id_ref === null ? null : Number(row.binding_notification_channel_id_ref),
        binding_attendance_voice_channel_id: row.binding_attendance_voice_channel_id,
        binding_attendance_voice_channel_name: row.binding_attendance_voice_channel_name,
        binding_attendance_voice_channel_cache_id: row.binding_attendance_voice_channel_id_ref === null ? null : Number(row.binding_attendance_voice_channel_id_ref),
      })));
  }

  async listTeacherDiscordChannelsForGuild(teacherId: number, discordGuildId: string) {
    const discordUserId = await this.getTeacherDiscordUserId(teacherId);
    if (!discordUserId) {
      return [];
    }

    const channels = await AppDataSource.getRepository(DiscordGuildChannelCache).find({
      where: {
        discord_user_id: discordUserId,
        discord_guild_id: discordGuildId,
      },
      order: {
        type: 'ASC',
        name: 'ASC',
      },
    });

    return channels.map((channel) => ({
      ...channel,
      teacher_id: teacherId,
    }));
  }

  countActiveStudentsForTeacher(teacherId: number) {
    return AppDataSource.getRepository(Student).countBy({
      teacher_id: teacherId,
      status: StudentStatus.Active,
    });
  }

  async countActiveStudentsWithDiscordUsernameForTeacher(teacherId: number) {
    const raw = await AppDataSource.getRepository(Student)
      .createQueryBuilder('student')
      .select('COUNT(*)', 'count')
      .where('student.teacher_id = :teacherId', { teacherId })
      .andWhere('student.status = :status', { status: StudentStatus.Active })
      .andWhere("student.discord_username IS NOT NULL AND LEN(TRIM(student.discord_username)) > 0")
      .getRawOne<{ count: string }>();

    return Number(raw?.count ?? 0);
  }

  async countActiveStudentsWithDiscordAuthorizationForTeacher(teacherId: number) {
    const raw = await AppDataSource.getRepository(Student)
      .createQueryBuilder('student')
      .select('COUNT(*)', 'count')
      .where('student.teacher_id = :teacherId', { teacherId })
      .andWhere('student.status = :status', { status: StudentStatus.Active })
      .andWhere('student.discord_authorized_at IS NOT NULL')
      .andWhere("student.discord_user_id IS NOT NULL AND LEN(TRIM(student.discord_user_id)) > 0")
      .getRawOne<{ count: string }>();

    return Number(raw?.count ?? 0);
  }

  countActiveClassesForTeacher(teacherId: number) {
    return AppDataSource.getRepository(Class).countBy({
      teacher_id: teacherId,
      status: ClassStatus.Active,
    });
  }

  async countConfiguredDiscordGuildsForTeacher(teacherId: number) {
    const raw = await AppDataSource.getRepository(ClassDiscordBinding)
      .createQueryBuilder('guild_binding')
      .innerJoin(Class, 'class', 'class.id = guild_binding.class_id AND class.teacher_id = guild_binding.teacher_id')
      .select('COUNT(*)', 'count')
      .where('guild_binding.teacher_id = :teacherId', { teacherId })
      .andWhere('class.status = :status', { status: ClassStatus.Active })
      .getRawOne<{ count: string }>();

    return Number(raw?.count ?? 0);
  }

  async listActiveClassesMissingDiscordGuildNamesForTeacher(teacherId: number) {
    const rows = await AppDataSource.getRepository(Class)
      .createQueryBuilder('class')
      .leftJoin(
        ClassDiscordBinding,
        'guild_binding',
        'guild_binding.teacher_id = class.teacher_id AND guild_binding.class_id = class.id',
      )
      .select('class.name', 'name')
      .where('class.teacher_id = :teacherId', { teacherId })
      .andWhere('class.status = :status', { status: ClassStatus.Active })
      .andWhere('guild_binding.id IS NULL')
      .orderBy('class.name', 'ASC')
      .getRawMany<{ name: string }>();

    return rows.map((row) => row.name);
  }

  async countDiscordUserGuildsForTeacher(teacherId: number) {
    const discordUserId = await this.getTeacherDiscordUserId(teacherId);
    if (!discordUserId) {
      return 0;
    }

    return AppDataSource.getRepository(DiscordUserGuild).countBy({
      discord_user_id: discordUserId,
    });
  }
}
