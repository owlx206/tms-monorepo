import type { StudentSummary } from '../dto/StudentDto.js';

type StudentReader = {
  getStudentById(teacherId: number, studentId: number): Promise<StudentSummary>;
};

export class GetStudentByIdUseCase {
  constructor(private readonly students: StudentReader) {}

  execute(teacherId: number, studentId: number): Promise<StudentSummary> {
    return this.students.getStudentById(teacherId, studentId);
  }
}
