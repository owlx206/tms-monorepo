import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { Teacher } from '../../../../../entities/teacher.entity.js';

export class TypeOrmTeacherWriter {
  create(input: Partial<Teacher>): Teacher {
    return AppDataSource.getRepository(Teacher).create(input);
  }

  save(teacher: Teacher): Promise<Teacher> {
    return AppDataSource.getRepository(Teacher).save(teacher);
  }

  findById(teacherId: number): Promise<Teacher | null> {
    return AppDataSource.getRepository(Teacher).findOneBy({ id: teacherId });
  }

  findByUsername(username: string): Promise<Teacher | null> {
    return AppDataSource.getRepository(Teacher).findOneBy({ username });
  }

  listNewestFirst(): Promise<Teacher[]> {
    return AppDataSource.getRepository(Teacher).find({
      order: {
        created_at: 'DESC',
      },
    });
  }
}
