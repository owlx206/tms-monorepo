import type { EntityManager } from 'typeorm';

import { cancelUpcomingScheduledSessionsForClass } from './ClassArchiveSupport.js';

export class TypeOrmClassSessionLifecycle {
  constructor(private readonly manager: EntityManager) {}

  cancelUpcomingScheduledSessions(teacherId: number, classId: number, archivedAt: Date): Promise<void> {
    return cancelUpcomingScheduledSessionsForClass(this.manager, teacherId, classId, archivedAt);
  }
}
