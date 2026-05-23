import { HttpError } from '../../../../shared/errors/HttpError.js';
import { isUniqueViolation } from '../mappers/AuthMapper.js';
import { toAdminTeacher } from '../mappers/AdminMapper.js';
import type { UpdateTeacherByAdminInput } from '../../contracts/types.js';
import type { BcryptPasswordHasher } from '../../infrastructure/security.js';
import type { TypeOrmTeacherWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

export class UpdateTeacherByAdminUseCase {
  constructor(
    private readonly teacherWriter: TypeOrmTeacherWriter,
    private readonly passwordHasher: BcryptPasswordHasher,
  ) {}

  async execute(actorTeacherId: number, teacherId: number, input: UpdateTeacherByAdminInput) {
    const teacher = await this.teacherWriter.findById(teacherId);

    if (!teacher) {
      throw new HttpError('teacher not found', 404);
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
      return toAdminTeacher(saved, codeforcesCredential);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError('username already exists', 409);
      }

      throw error;
    }
  }
}
