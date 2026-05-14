import type { ClassScheduleSummary } from '../dto/ClassDto.js';

type ClassScheduleReader = {
  listClassSchedules(teacherId: number, classId: number): Promise<ClassScheduleSummary[]>;
};

export class ClassScheduleUseCase {
  constructor(private readonly schedules: ClassScheduleReader) {}

  list(teacherId: number, classId: number): Promise<ClassScheduleSummary[]> {
    return this.schedules.listClassSchedules(teacherId, classId);
  }
}
