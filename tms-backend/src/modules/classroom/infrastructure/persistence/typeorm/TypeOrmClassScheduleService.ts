import type { EntityManager } from 'typeorm';

import type { ClassScheduleInput, ClassScheduleSummary } from '../../../application/dto/ClassDto.js';
import { ClassSchedule } from '../../../../../entities/class-schedule.entity.js';
import { replaceClassSchedules } from './ClassScheduleSupport.js';
import { ClassScheduleMapper } from './ClassScheduleMapper.js';

export class TypeOrmClassScheduleService {
  constructor(private readonly manager: EntityManager) {}

  replaceSchedules(teacherId: number, classId: number, schedules: ClassScheduleInput[]): Promise<void> {
    return replaceClassSchedules(this.manager, teacherId, classId, schedules);
  }

  async listSchedules(teacherId: number, classId: number): Promise<ClassScheduleSummary[]> {
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

    return schedules.map((schedule) => ClassScheduleMapper.toSummary(schedule));
  }
}
