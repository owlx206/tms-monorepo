import type { Teacher } from '../../../../../entities/teacher.entity.js';

export interface TeacherRepository {
  create(input: Partial<Teacher>): Teacher;
  save(teacher: Teacher): Promise<Teacher>;
  findById(teacherId: number): Promise<Teacher | null>;
  findByUsername(username: string): Promise<Teacher | null>;
  listNewestFirst(): Promise<Teacher[]>;
}
