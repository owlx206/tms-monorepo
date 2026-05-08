import type { EntityManager } from 'typeorm';

import { DomainError } from '../../../../../shared/domain/DomainError.js';
import type { Student } from '../../../domain/models/Student.js';
import { StudentId } from '../../../domain/value-objects/StudentId.js';
import type { StudentRepository } from '../../../domain/repositories/StudentRepository.js';
import { StudentMapper } from './StudentMapper.js';
import { Student as StudentOrmEntity } from './StudentOrmEntity.js';

export class TypeOrmStudentRepository implements StudentRepository {
  constructor(
    private readonly manager: EntityManager,
    private readonly mapper = new StudentMapper(),
  ) {}

  async codeforcesHandleExists(
    teacherId: number,
    codeforcesHandle: string,
    excludeStudentId?: number,
  ): Promise<boolean> {
    const queryBuilder = this.manager
      .getRepository(StudentOrmEntity)
      .createQueryBuilder('student')
      .where('student.teacher_id = :teacherId', { teacherId })
      .andWhere('student.codeforces_handle IS NOT NULL')
      .andWhere('LOWER(student.codeforces_handle) = LOWER(:handle)', {
        handle: codeforcesHandle,
      });

    if (excludeStudentId !== undefined) {
      queryBuilder.andWhere('student.id <> :excludeStudentId', { excludeStudentId });
    }

    return queryBuilder.getExists();
  }

  async requireById(id: StudentId): Promise<Student> {
    const entity = await this.manager.getRepository(StudentOrmEntity).findOneBy({ id: id.value });

    if (!entity) {
      throw new DomainError('student_not_found', 'student not found');
    }

    return this.mapper.toDomain(entity);
  }

  async save(student: Student): Promise<Student> {
    const entity = this.mapper.toPersistence(student);
    const saved = await this.manager.getRepository(StudentOrmEntity).save(entity);

    return this.mapper.toDomain(saved);
  }
}
