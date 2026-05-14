import type { Student } from '../models/Student.js';
import type { StudentId } from '../value-objects/StudentId.js';

export interface StudentWriter {
  codeforcesHandleExists(teacherId: number, codeforcesHandle: string, excludeStudentId?: number): Promise<boolean>;
  requireById(id: StudentId): Promise<Student>;
  save(student: Student): Promise<Student>;
}
