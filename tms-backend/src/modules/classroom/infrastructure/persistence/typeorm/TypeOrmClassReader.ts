import type { EntityManager, FindOptionsWhere } from 'typeorm';

import { Enrollment, Student, StudentStatus } from '../../../../../entities/index.js';
import type { ClassStatus } from '../../../../../entities/enums.js';
import type {
  ClassDetails,
  ClassDiscordServerSummary,
  ClassListFilters,
  ClassScheduleSummary,
  ClassSummary,
} from '../../../application/dto/ClassDto.js';
import { DiscordServer } from '../../../../../entities/discord-server.entity.js';
import { ClassSchedule } from '../../../../../entities/class-schedule.entity.js';
import { Class } from '../../../../../entities/class.entity.js';

export class TypeOrmClassReader {
  constructor(private readonly manager: EntityManager) {}

  async listClasses(teacherId: number, filters: ClassListFilters): Promise<ClassSummary[]> {
    if (filters.ready_only) {
      const classes = await this.manager.getRepository(Class)
        .createQueryBuilder('classEntity')
        .where('classEntity.teacher_id = :teacherId', { teacherId })
        .andWhere(filters.status ? 'classEntity.status = :status' : '1=1', { status: filters.status })
        .andWhere((qb) => {
          const scheduleSubquery = qb.subQuery()
            .select('1')
            .from(ClassSchedule, 'schedule')
            .where('schedule.teacher_id = classEntity.teacher_id')
            .andWhere('schedule.class_id = classEntity.id')
            .getQuery();
          return `EXISTS ${scheduleSubquery}`;
        })
        .andWhere((qb) => {
          const serverSubquery = qb.subQuery()
            .select('1')
            .from(DiscordServer, 'server')
            .where('server.teacher_id = classEntity.teacher_id')
            .andWhere('server.class_id = classEntity.id')
            .getQuery();
          return `EXISTS ${serverSubquery}`;
        })
        .orderBy('classEntity.created_at', 'DESC')
        .getMany();

      return classes.map((classEntity) => this.toSummary(classEntity));
    }

    const where: FindOptionsWhere<Class> = {
      teacher_id: teacherId,
      ...(filters.status ? { status: filters.status as ClassStatus } : {}),
    };

    const classes = await this.manager.getRepository(Class).find({
      where,
      order: {
        created_at: 'DESC',
      },
    });

    return classes.map((classEntity) => this.toSummary(classEntity));
  }

  async getClassById(teacherId: number, classId: number): Promise<ClassSummary | null> {
    const classEntity = await this.manager.getRepository(Class).findOneBy({
      id: classId,
      teacher_id: teacherId,
    });

    return classEntity ? this.toSummary(classEntity) : null;
  }

  async getClassDetails(teacherId: number, classId: number): Promise<ClassDetails | null> {
    const classEntity = await this.manager.getRepository(Class).findOneBy({
      id: classId,
      teacher_id: teacherId,
    });

    if (!classEntity) {
      return null;
    }

    const [schedules, discordServer, activeStudents] = await Promise.all([
      this.manager.getRepository(ClassSchedule).find({
        where: {
          teacher_id: teacherId,
          class_id: classId,
        },
        order: {
          day_of_week: 'ASC',
          start_time: 'ASC',
        },
      }),
      this.manager.getRepository(DiscordServer).findOneBy({
        teacher_id: teacherId,
        class_id: classId,
      }),
      this.manager.getRepository(Student)
        .createQueryBuilder('student')
        .innerJoin(Enrollment, 'enrollment', [
          'enrollment.student_id = student.id',
          'enrollment.teacher_id = student.teacher_id',
          'enrollment.unenrolled_at IS NULL',
          'enrollment.class_id = :classId',
        ].join(' AND '), { classId })
        .where('student.teacher_id = :teacherId', { teacherId })
        .andWhere('student.status = :activeStatus', { activeStatus: StudentStatus.Active })
        .orderBy('student.full_name', 'ASC')
        .select([
          'student.id AS id',
          'student.teacher_id AS teacher_id',
          'student.full_name AS full_name',
          'student.codeforces_handle AS codeforces_handle',
          'student.discord_username AS discord_username',
          'student.discord_user_id AS discord_user_id',
          'student.phone AS phone',
          'student.status AS status',
          'enrollment.enrolled_at AS enrolled_at',
        ])
        .getRawMany<{
          id: number;
          teacher_id: number;
          full_name: string;
          codeforces_handle: string | null;
          discord_username: string | null;
          discord_user_id: string | null;
          phone: string | null;
          status: string;
          enrolled_at: Date;
        }>(),
    ]);

    return {
      class: this.toSummary(classEntity),
      schedules: schedules.map((schedule) => this.toScheduleSummary(schedule)),
      discord_server: discordServer ? this.toDiscordServerSummary(discordServer) : null,
      active_students: activeStudents.map((student) => ({
        id: Number(student.id),
        teacher_id: Number(student.teacher_id),
        full_name: student.full_name,
        codeforces_handle: student.codeforces_handle,
        discord_username: student.discord_username,
        discord_user_id: student.discord_user_id,
        phone: student.phone,
        status: student.status,
        enrolled_at: student.enrolled_at,
      })),
      is_ready: schedules.length > 0 && discordServer !== null,
    };
  }

  private toSummary(classEntity: Class): ClassSummary {
    return {
      id: classEntity.id,
      teacher_id: classEntity.teacher_id,
      name: classEntity.name,
      fee_per_session: classEntity.fee_per_session,
      status: classEntity.status,
      created_at: classEntity.created_at,
      archived_at: classEntity.archived_at,
    };
  }

  private toScheduleSummary(schedule: ClassSchedule): ClassScheduleSummary {
    return {
      id: schedule.id,
      teacher_id: schedule.teacher_id,
      class_id: schedule.class_id,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
    };
  }

  private toDiscordServerSummary(server: DiscordServer): ClassDiscordServerSummary {
    return {
      id: server.id,
      teacher_id: server.teacher_id,
      class_id: server.class_id,
      discord_server_id: server.discord_server_id,
      name: server.name,
      attendance_voice_channel_id: server.attendance_voice_channel_id,
      notification_channel_id: server.notification_channel_id,
    };
  }
}
