import { TeacherRole } from '../../../../entities/enums.js';
import { ServiceError } from '../../../../shared/errors/service.error.js';
import { isUniqueViolation } from '../mappers/AuthMapper.js';
import { toAdminTeacher } from '../mappers/AdminMapper.js';
import type { CreateTeacherByAdminInput } from '../dto/AdminDto.js';
import type { BcryptPasswordHasher } from '../../infrastructure/security/BcryptPasswordHasher.js';
import type { TypeOrmTeacherWriter } from '../../infrastructure/persistence/typeorm/TypeOrmTeacherWriter.js';

export class CreateTeacherByAdminUseCase {
  constructor(
    private readonly teacherWriter: TypeOrmTeacherWriter,
    private readonly passwordHasher: BcryptPasswordHasher,
  ) {}

  async execute(input: CreateTeacherByAdminInput) {
    const passwordHash = await this.passwordHasher.hash(input.password);

    const teacher = this.teacherWriter.create({
      username: input.username,
      password_hash: passwordHash,
      role: input.role ?? TeacherRole.Teacher,
      is_active: input.is_active ?? true,
      codeforces_handle: input.codeforces_handle,
      codeforces_api_key: input.codeforces_api_key,
      codeforces_api_secret: input.codeforces_api_secret,
    });

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
