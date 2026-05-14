import { TeacherRole } from '../../../../entities/enums.js';
import { ServiceError } from '../../../../shared/errors/service.error.js';
import { isUniqueViolation } from '../mappers/AuthMapper.js';
import { toAdminTeacher } from '../mappers/AdminMapper.js';
import type { UpdateTeacherByAdminInput } from '../dto/AdminDto.js';
import type { BcryptPasswordHasher } from '../../infrastructure/security/BcryptPasswordHasher.js';
import type { TypeOrmTeacherWriter } from '../../infrastructure/persistence/typeorm/TypeOrmTeacherWriter.js';

export class UpdateTeacherByAdminUseCase {
  constructor(
    private readonly teacherWriter: TypeOrmTeacherWriter,
    private readonly passwordHasher: BcryptPasswordHasher,
  ) {}

  async execute(actorTeacherId: number, teacherId: number, input: UpdateTeacherByAdminInput) {
    const teacher = await this.teacherWriter.findById(teacherId);

    if (!teacher) {
      throw new ServiceError('teacher not found', 404);
    }

    if (input.role !== undefined) {
      if (actorTeacherId === teacher.id && input.role !== TeacherRole.SysAdmin) {
        throw new ServiceError('cannot remove sysadmin role from current account', 409);
      }

      teacher.role = input.role;
    }

    if (input.is_active !== undefined) {
      if (actorTeacherId === teacher.id && !input.is_active) {
        throw new ServiceError('cannot deactivate current account', 409);
      }

      teacher.is_active = input.is_active;
    }

    if (input.username !== undefined) {
      teacher.username = input.username;
    }

    if (input.password !== undefined) {
      teacher.password_hash = await this.passwordHasher.hash(input.password);
    }

    if (input.codeforces_handle !== undefined) {
      teacher.codeforces_handle = input.codeforces_handle;
    }

    if (input.codeforces_api_key !== undefined) {
      teacher.codeforces_api_key = input.codeforces_api_key;
    }

    if (input.codeforces_api_secret !== undefined) {
      teacher.codeforces_api_secret = input.codeforces_api_secret;
    }

    try {
      const saved = await this.teacherWriter.save(teacher);
      return toAdminTeacher(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ServiceError('username already exists', 409);
      }

      throw error;
    }
  }
}
