import type { StudentListFilters, StudentSummary } from '../dto/StudentDto.js';

type StudentReader = {
  listStudents(teacherId: number, filters: StudentListFilters): Promise<StudentSummary[]>;
};

export class ListStudentsUseCase {
  constructor(private readonly students: StudentReader) {}

  execute(teacherId: number, filters: StudentListFilters): Promise<StudentSummary[]> {
    return this.students.listStudents(teacherId, filters);
  }
}
