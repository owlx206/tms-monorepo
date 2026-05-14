import type { EntityManager } from 'typeorm';
import { IsNull } from 'typeorm';

import type { Enrollment } from '../../../domain/models/Enrollment.js';
import { StudentId } from '../../../domain/value-objects/StudentId.js';
import type { EnrollmentRepository } from '../../../domain/repositories/EnrollmentRepository.js';
import { EnrollmentMapper } from './EnrollmentMapper.js';
import { Enrollment as EnrollmentOrmEntity } from '../../../../../entities/enrollment.entity.js';

export class TypeOrmEnrollmentRepository implements EnrollmentRepository {
  constructor(
    private readonly manager: EntityManager,
    private readonly mapper = new EnrollmentMapper(),
  ) {}

  async findActiveByStudent(teacherId: number, studentId: StudentId): Promise<Enrollment | null> {
    const entity = await this.manager.getRepository(EnrollmentOrmEntity).findOne({
      where: {
        teacher_id: teacherId,
        student_id: studentId.value,
        unenrolled_at: IsNull(),
      },
    });

    return entity ? this.mapper.toDomain(entity) : null;
  }

  async save(enrollment: Enrollment): Promise<Enrollment> {
    const entity = this.mapper.toPersistence(enrollment);
    const saved = await this.manager.getRepository(EnrollmentOrmEntity).save(entity);

    return this.mapper.toDomain(saved);
  }
}
