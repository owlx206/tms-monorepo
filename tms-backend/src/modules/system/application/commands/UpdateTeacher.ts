import { HttpError } from '../../../../shared/errors/HttpError.js';
import config from '../../../../config.js';
import { isUniqueViolation } from '../../../account/application/mappers/AuthMapper.js';
import { toTeacherAccount } from '../../../account/application/mappers/TeacherAccountMapper.js';
import type { UpdateTeacherAccountInput } from '../../../account/contracts/types.js';
import type { BcryptPasswordHasher } from '../../../../infrastructure/security/auth.js';
import type { TypeOrmTeacherWriter } from '../../../account/infrastructure/persistence/typeorm/Writer.js';

export class UpdateTeacher {
  constructor(
    private readonly teacherWriter: TypeOrmTeacherWriter,
    private readonly passwordHasher: BcryptPasswordHasher,
  ) {}

  async execute(actorTeacherId: number, teacherId: number, input: UpdateTeacherAccountInput) {
    const teacher = await this.teacherWriter.findById(teacherId);

    if (!teacher) {
      throw new HttpError('teacher not found', 404);
    }

    if (teacher.username === config.auth.sysAdminUsername) {
      throw new HttpError('admin account is not a teacher account', 404);
    }

    if (input.is_active !== undefined) {
      if (actorTeacherId === teacher.id && !input.is_active) {
        throw new HttpError('cannot deactivate current account', 409);
      }

      teacher.is_active = input.is_active;
    }

    if (input.username !== undefined) {
      teacher.username = input.username;
    }

    if (input.password !== undefined) {
      teacher.password_hash = await this.passwordHasher.hash(input.password);
    }

    try {
      const saved = await this.teacherWriter.save(teacher);
      const codeforcesCredential = await this.teacherWriter.saveTeacherCodeforcesCredential(saved.id, {
        codeforces_handle: input.codeforces_handle,
        codeforces_api_key: input.codeforces_api_key,
        codeforces_api_secret: input.codeforces_api_secret,
      });
      return toTeacherAccount(saved, codeforcesCredential);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError('username already exists', 409);
      }

      throw error;
    }
  }
}
