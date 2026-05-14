import type { EntityManager } from 'typeorm';

import type { StudentBalanceSnapshot } from '../../../application/dto/StudentDto.js';
import { loadBalanceSnapshotForStudent } from './EnrollmentDataAccess.js';

export class TypeOrmBalanceSnapshotReader {
  constructor(private readonly manager: EntityManager) {}

  loadForStudent(teacherId: number, studentId: number): Promise<StudentBalanceSnapshot> {
    return loadBalanceSnapshotForStudent(this.manager, teacherId, studentId);
  }
}
