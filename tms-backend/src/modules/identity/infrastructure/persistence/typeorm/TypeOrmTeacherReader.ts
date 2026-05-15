import type { EntityManager } from 'typeorm';

import { Teacher } from '../../../../../entities/teacher.entity.js';
import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import type { AdminTeacher } from '../../../application/dto/AdminDto.js';

export class TypeOrmTeacherReader {
  constructor(private readonly manager: EntityManager = AppDataSource.manager) {}

  async listAdminTeachers(): Promise<AdminTeacher[]> {
    const teachers = await this.manager.getRepository(Teacher).find({
      order: {
        created_at: 'DESC',
      },
    });

    return teachers.map((teacher) => ({
      id: teacher.id,
      username: teacher.username,
      role: teacher.role,
      is_active: teacher.is_active,
      codeforces_handle: teacher.codeforces_handle,
      has_codeforces_api_key: teacher.codeforces_api_key !== null,
      has_codeforces_api_secret: teacher.codeforces_api_secret !== null,
      created_at: teacher.created_at,
    }));
  }
}
