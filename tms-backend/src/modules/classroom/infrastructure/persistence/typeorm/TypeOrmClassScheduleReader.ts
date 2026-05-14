import type { EntityManager } from 'typeorm';

import type { ClassScheduleSummary } from '../../../application/dto/ClassDto.js';
import { ClassSchedule } from '../../../../../entities/class-schedule.entity.js';

export class TypeOrmClassScheduleReader {
  constructor(private readonly manager: EntityManager) {}

  async listClassSchedules(teacherId: number, classId: number): Promise<ClassScheduleSummary[]> {
    const schedules = await this.manager.getRepository(ClassSchedule).find({
      where: {
        teacher_id: teacherId,
        class_id: classId,
      },
      order: {
        day_of_week: 'ASC',
        start_time: 'ASC',
        end_time: 'ASC',
      },
    });

    return schedules.map((schedule) => ({
      id: schedule.id,
      teacher_id: schedule.teacher_id,
      class_id: schedule.class_id,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
    }));
  }
}
