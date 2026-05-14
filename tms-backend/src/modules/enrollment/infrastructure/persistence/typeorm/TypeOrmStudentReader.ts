import type { EntityManager } from 'typeorm';

import { DomainError } from '../../../../../shared/domain/DomainError.js';
import type { StudentListFilters, StudentSummary } from '../../../application/dto/StudentDto.js';
import {
  createZeroBalanceSnapshot,
  findActiveEnrollment,
  findActiveEnrollmentsByStudentIds,
  listStudentsForTeacher,
  loadBalanceSnapshotForStudent,
  loadBalanceSnapshots,
} from './EnrollmentDataAccess.js';
import { Student as Student } from '../../../../../entities/student.entity.js';
import { toStudentSummary } from './StudentSummaryMapper.js';

export class TypeOrmStudentReader {
  constructor(private readonly manager: EntityManager) {}

  async listStudents(teacherId: number, filters: StudentListFilters): Promise<StudentSummary[]> {
    const students = await listStudentsForTeacher(this.manager, teacherId, filters);

    if (students.length === 0) {
      return [];
    }

    const studentIds = students.map((student) => student.id);
    const activeEnrollments = await findActiveEnrollmentsByStudentIds(this.manager, teacherId, studentIds);
    const activeEnrollmentByStudentId = new Map<number, (typeof activeEnrollments)[number]>();
    activeEnrollments.forEach((enrollment) => {
      activeEnrollmentByStudentId.set(enrollment.student_id, enrollment);
    });

    const balanceByStudentId = await loadBalanceSnapshots(this.manager, teacherId, studentIds);

    return students.map((student) => {
      const activeEnrollment = activeEnrollmentByStudentId.get(student.id) ?? null;
      const balanceSnapshot = balanceByStudentId.get(student.id) ?? createZeroBalanceSnapshot();

      return toStudentSummary(student, {
        current_class_id: activeEnrollment?.class_id ?? null,
        current_enrollment_id: activeEnrollment?.id ?? null,
        balance_snapshot: balanceSnapshot,
      });
    });
  }

  async getStudentById(teacherId: number, studentId: number): Promise<StudentSummary> {
    const student = await this.manager.getRepository(Student).findOneBy({ id: studentId });
    if (!student) {
      throw new DomainError('student_not_found', 'student not found');
    }

    const activeEnrollment = await findActiveEnrollment(this.manager, teacherId, studentId);
    const balanceSnapshot = await loadBalanceSnapshotForStudent(this.manager, teacherId, studentId);

    return toStudentSummary(student, {
      current_class_id: activeEnrollment?.class_id ?? null,
      current_enrollment_id: activeEnrollment?.id ?? null,
      balance_snapshot: balanceSnapshot,
    });
  }
}
