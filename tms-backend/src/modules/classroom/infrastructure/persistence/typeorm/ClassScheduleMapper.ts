import type { ClassScheduleSummary } from '../../../application/dto/ClassDto.js';
import type { ClassSchedule } from '../../../../../entities/class-schedule.entity.js';

export class ClassScheduleMapper {
  static toSummary(schedule: ClassSchedule): ClassScheduleSummary {
    return {
      id: schedule.id,
      teacher_id: schedule.teacher_id,
      class_id: schedule.class_id,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
    };
  }
}
