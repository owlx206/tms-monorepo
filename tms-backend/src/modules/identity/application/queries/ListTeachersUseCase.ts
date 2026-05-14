import type { Teacher } from '../../../../entities/teacher.entity.js';
import { toAdminTeacher } from '../mappers/AdminMapper.js';

type TeacherReader = {
  listNewestFirst(): Promise<Teacher[]>;
};

export class ListTeachersUseCase {
  constructor(private readonly teachers: TeacherReader) {}

  async execute() {
    const teachers = await this.teachers.listNewestFirst();
    return teachers.map(toAdminTeacher);
  }
}
