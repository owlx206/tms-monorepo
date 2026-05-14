import type { EntityManager } from 'typeorm';

import { reconcileGeneratedSessionsForClass } from './ClassScheduleSupport.js';

export class TypeOrmClassScheduleSessionGenerator {
  constructor(private readonly manager: EntityManager) {}

  reconcileGeneratedSessionsForClass(
    teacherId: number,
    classId: number,
  ): Promise<{ sessions_created: number; sessions_removed: number }> {
    return reconcileGeneratedSessionsForClass(this.manager, teacherId, classId);
  }
}
