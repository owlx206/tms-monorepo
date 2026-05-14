import { AuthError } from '../../../../shared/errors/auth.error.js';
import { toAuthTeacher, isUniqueViolation } from '../mappers/AuthMapper.js';
import type { UpdateTeacherInput } from '../dto/AuthDto.js';
import type { TypeOrmTeacherWriter } from '../../infrastructure/persistence/typeorm/TypeOrmTeacherWriter.js';
import type { BcryptPasswordHasher } from '../../infrastructure/security/BcryptPasswordHasher.js';

export class UpdateMyProfileUseCase {
  constructor(
    private readonly teacherWriter: TypeOrmTeacherWriter,
    private readonly passwordHasher: BcryptPasswordHasher,
  ) {}

  async execute(teacherId: number, input: UpdateTeacherInput) {
    const teacher = await this.teacherWriter.findById(teacherId);

    if (!teacher) {
      throw new AuthError('teacher not found', 404);
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
      return toAuthTeacher(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AuthError('username already exists', 409);
      }

      throw error;
    }
  }
}
