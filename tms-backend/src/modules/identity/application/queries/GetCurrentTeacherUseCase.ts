import type { Teacher } from '../../infrastructure/persistence/typeorm/entities/teacher.entity.js';
import { toAuthTeacher } from '../mappers/AuthMapper.js';

export class GetCurrentTeacherUseCase {
  execute(teacher: Teacher) {
    return toAuthTeacher(teacher);
  }
}
