import type { Enrollment } from '../models/Enrollment.js';
import type { StudentId } from '../value-objects/StudentId.js';

export interface EnrollmentWriter {
  findActiveByStudent(teacherId: number, studentId: StudentId): Promise<Enrollment | null>;
  save(enrollment: Enrollment): Promise<Enrollment>;
}
