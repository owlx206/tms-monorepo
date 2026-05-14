import type { EntityManager } from 'typeorm';

import { assertClassArchivable } from './ClassArchiveSupport.js';

export class TypeOrmClassArchiveGuard {
  constructor(private readonly manager: EntityManager) {}

  assertArchivable(teacherId: number, classId: number): Promise<void> {
    return assertClassArchivable(this.manager, teacherId, classId);
  }
}
