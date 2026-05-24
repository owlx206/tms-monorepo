import { HttpError } from '../../../../shared/errors/HttpError.js';
import { toAuthTeacher, isUniqueViolation } from '../mappers/AuthMapper.js';
import type { JwtAccessTokenSigner } from '../../infrastructure/security.js';
import type { BcryptPasswordHasher } from '../../infrastructure/security.js';
import type { TypeOrmTeacherWriter } from '../../infrastructure/persistence/typeorm/Writer.js';
import type { RegisterInput } from '../../contracts/types.js';

export class Register {
  constructor(
    private readonly teacherWriter: TypeOrmTeacherWriter,
    private readonly passwordHasher: BcryptPasswordHasher,
    private readonly accessTokenSigner: JwtAccessTokenSigner,
    private readonly tokenExpiresIn: string | undefined,
  ) {}

  async execute(input: RegisterInput) {
    const passwordHash = await this.passwordHasher.hash(input.password);

    const teacher = this.teacherWriter.create({
      username: input.username,
      password_hash: passwordHash,
      is_active: true,
    });

    try {
      const savedTeacher = await this.teacherWriter.save(teacher);

      const codeforcesCredential = await this.teacherWriter.saveTeacherCodeforcesCredential(savedTeacher.id, {
        codeforces_handle: input.codeforces_handle,
        codeforces_api_key: input.codeforces_api_key,
        codeforces_api_secret: input.codeforces_api_secret,
      });

      return {
        accessToken: this.accessTokenSigner.sign({
          sub: savedTeacher.id,
          username: savedTeacher.username,
        }),
        tokenType: 'Bearer' as const,
        expiresIn: this.tokenExpiresIn,
        teacher: toAuthTeacher(savedTeacher, codeforcesCredential),
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError('username already exists', 409);
      }

      throw error;
    }
  }
}
