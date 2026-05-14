import type { ClassSchedule } from '../../../../../entities/class-schedule.entity.js';
import type { Class } from '../../../../../entities/class.entity.js';

export interface ClassScheduleRepository {
  findClassById(teacherId: number, classId: number): Promise<Class | null>;
  findByIdForClass(
    teacherId: number,
    classId: number,
    scheduleId: number,
  ): Promise<ClassSchedule | null>;
  countByClass(teacherId: number, classId: number): Promise<number>;
  hasOverlappingPersistedSchedule(
    teacherId: number,
    schedule: {
      day_of_week: number;
      start_time: string;
      end_time: string;
    },
    options?: {
      excludeClassId?: number;
      excludeScheduleId?: number;
    },
  ): Promise<boolean>;
  hasOverlappingUpcomingSessions(
    teacherId: number,
    classId: number,
    schedules: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>,
  ): Promise<boolean>;
  create(input: {
    teacher_id: number;
    class_id: number;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }): ClassSchedule;
  save(schedule: ClassSchedule): Promise<ClassSchedule>;
  remove(schedule: ClassSchedule): Promise<ClassSchedule>;
}
