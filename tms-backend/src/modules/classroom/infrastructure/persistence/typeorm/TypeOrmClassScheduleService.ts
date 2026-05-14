import type { EntityManager } from 'typeorm';

import type { ClassScheduleInput } from '../../../application/dto/ClassDto.js';
import { replaceClassSchedules } from './ClassScheduleSupport.js';

export class TypeOrmClassScheduleService {
  constructor(private readonly manager: EntityManager) {}

  replaceSchedules(teacherId: number, classId: number, schedules: ClassScheduleInput[]): Promise<void> {
    return replaceClassSchedules(this.manager, teacherId, classId, schedules);
  }
}
