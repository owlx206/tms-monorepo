import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import {
  ClassStatus,
  StudentStatus,
  Student,
} from '../../../../../entities/index.js';
import { Class } from '../../../../../entities/class.entity.js';
import { DiscordServer } from '../../../../../entities/discord-server.entity.js';
import { TeacherDiscordChannelCache } from '../../../../../entities/teacher-discord-channel-cache.entity.js';
import { TeacherDiscordServerCache } from '../../../../../entities/teacher-discord-server-cache.entity.js';

export class TypeOrmMessagingReader {
  async listDiscordServersForTeacher(teacherId: number) {
    return AppDataSource.getRepository(DiscordServer).find({
      where: { teacher_id: teacherId },
      order: { id: 'DESC' },
    });
  }

  async listTeacherDiscordServers(teacherId: number) {
    return AppDataSource.getRepository(TeacherDiscordServerCache)
      .createQueryBuilder('server_cache')
      .leftJoin(
        DiscordServer,
        'class_binding',
        'class_binding.teacher_id = server_cache.teacher_id AND class_binding.discord_server_id = server_cache.discord_server_id',
      )
      .leftJoin(
        Class,
        'class',
        'class.id = class_binding.class_id AND class.teacher_id = class_binding.teacher_id',
      )
      .leftJoin(
        TeacherDiscordChannelCache,
        'notification_channel_cache',
        'notification_channel_cache.teacher_id = class_binding.teacher_id AND notification_channel_cache.discord_server_id = class_binding.discord_server_id AND notification_channel_cache.discord_channel_id = class_binding.notification_channel_id',
      )
      .leftJoin(
        TeacherDiscordChannelCache,
        'voice_channel_cache',
        'voice_channel_cache.teacher_id = class_binding.teacher_id AND voice_channel_cache.discord_server_id = class_binding.discord_server_id AND voice_channel_cache.discord_channel_id = class_binding.attendance_voice_channel_id',
      )
      .select('server_cache.id', 'id')
      .addSelect('server_cache.teacher_id', 'teacher_id')
      .addSelect('server_cache.discord_server_id', 'discord_server_id')
      .addSelect('server_cache.name', 'name')
      .addSelect('server_cache.synced_at', 'synced_at')
      .addSelect(`
        CASE
          WHEN class_binding.id IS NOT NULL THEN 'class'
          ELSE 'unbound'
        END
      `, 'binding_role')
      .addSelect('class_binding.id', 'binding_server_id')
      .addSelect('class_binding.class_id', 'binding_class_id')
      .addSelect('class.name', 'binding_class_name')
      .addSelect('class_binding.notification_channel_id', 'binding_notification_channel_id')
      .addSelect('notification_channel_cache.name', 'binding_notification_channel_name')
      .addSelect('notification_channel_cache.id', 'binding_notification_channel_cache_id')
      .addSelect('class_binding.attendance_voice_channel_id', 'binding_attendance_voice_channel_id')
      .addSelect('voice_channel_cache.name', 'binding_attendance_voice_channel_name')
      .addSelect('voice_channel_cache.id', 'binding_attendance_voice_channel_cache_id')
      .where('server_cache.teacher_id = :teacherId', { teacherId })
      .orderBy('server_cache.name', 'ASC')
      .getRawMany<{
        id: string;
        teacher_id: string;
        discord_server_id: string;
        name: string;
        synced_at: string | Date;
        binding_server_id: string | null;
        binding_role: 'unbound' | 'class';
        binding_class_id: string | null;
        binding_class_name: string | null;
        binding_notification_channel_id: string | null;
        binding_notification_channel_name: string | null;
        binding_notification_channel_cache_id: string | null;
        binding_attendance_voice_channel_id: string | null;
        binding_attendance_voice_channel_name: string | null;
        binding_attendance_voice_channel_cache_id: string | null;
      }>()
      .then((rows) => rows.map((row) => ({
        id: Number(row.id),
        teacher_id: Number(row.teacher_id),
        discord_server_id: row.discord_server_id,
        name: row.name,
        synced_at: new Date(row.synced_at),
        binding_server_id: row.binding_server_id === null ? null : Number(row.binding_server_id),
        binding_role: row.binding_role,
        binding_class_id: row.binding_class_id === null ? null : Number(row.binding_class_id),
        binding_class_name: row.binding_class_name,
        binding_notification_channel_id: row.binding_notification_channel_id,
        binding_notification_channel_name: row.binding_notification_channel_name,
        binding_notification_channel_cache_id: row.binding_notification_channel_cache_id === null ? null : Number(row.binding_notification_channel_cache_id),
        binding_attendance_voice_channel_id: row.binding_attendance_voice_channel_id,
        binding_attendance_voice_channel_name: row.binding_attendance_voice_channel_name,
        binding_attendance_voice_channel_cache_id: row.binding_attendance_voice_channel_cache_id === null ? null : Number(row.binding_attendance_voice_channel_cache_id),
      })));
  }

  async listTeacherDiscordChannelsForServer(teacherId: number, discordServerId: string) {
    return AppDataSource.getRepository(TeacherDiscordChannelCache).find({
      where: {
        teacher_id: teacherId,
        discord_server_id: discordServerId,
      },
      order: {
        type: 'ASC',
        name: 'ASC',
      },
    });
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
      .andWhere("student.discord_username IS NOT NULL AND LENGTH(TRIM(student.discord_username)) > 0")
      .getRawOne<{ count: string }>();

    return Number(raw?.count ?? 0);
  }

  countActiveClassesForTeacher(teacherId: number) {
    return AppDataSource.getRepository(Class).countBy({
      teacher_id: teacherId,
      status: ClassStatus.Active,
    });
  }

  async countConfiguredDiscordServersForTeacher(teacherId: number) {
    const raw = await AppDataSource.getRepository(DiscordServer)
      .createQueryBuilder('server')
      .innerJoin(Class, 'class', 'class.id = server.class_id AND class.teacher_id = server.teacher_id')
      .select('COUNT(*)', 'count')
      .where('server.teacher_id = :teacherId', { teacherId })
      .andWhere('class.status = :status', { status: ClassStatus.Active })
      .getRawOne<{ count: string }>();

    return Number(raw?.count ?? 0);
  }

  async listActiveClassesMissingDiscordServerNamesForTeacher(teacherId: number) {
    const rows = await AppDataSource.getRepository(Class)
      .createQueryBuilder('class')
      .leftJoin(
        DiscordServer,
        'server',
        'server.teacher_id = class.teacher_id AND server.class_id = class.id',
      )
      .select('class.name', 'name')
      .where('class.teacher_id = :teacherId', { teacherId })
      .andWhere('class.status = :status', { status: ClassStatus.Active })
      .andWhere('server.id IS NULL')
      .orderBy('class.name', 'ASC')
      .getRawMany<{ name: string }>();

    return rows.map((row) => row.name);
  }

  countTeacherDiscordServerCaches(teacherId: number) {
    return AppDataSource.getRepository(TeacherDiscordServerCache).countBy({
      teacher_id: teacherId,
    });
  }
}
