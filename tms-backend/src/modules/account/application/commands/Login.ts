import { HttpError } from '../../../../shared/errors/HttpError.js';
import { toAuthTeacher } from '../mappers/AuthMapper.js';
import type { LoginInput } from '../../contracts/types.js';
import type { TypeOrmTeacherWriter } from '../../infrastructure/persistence/typeorm/Writer.js';
import type { JwtAccessTokenSigner } from '../../../../infrastructure/security/auth.js';
import type { BcryptPasswordHasher } from '../../../../infrastructure/security/auth.js';

export class Login {
  constructor(
    private readonly teacherWriter: TypeOrmTeacherWriter,
    private readonly passwordHasher: BcryptPasswordHasher,
    private readonly accessTokenSigner: JwtAccessTokenSigner,
    private readonly tokenExpiresIn: string | undefined,
  ) {}

  async execute(input: LoginInput) {
    const teacher = await this.teacherWriter.findByUsername(input.username);

    if (!teacher) {
      throw new HttpError('invalid username or password', 401);
    }

    if (!teacher.is_active) {
      throw new HttpError('account is inactive', 403);
    }

    const passwordMatches = await this.passwordHasher.compare(input.password, teacher.password_hash);
    if (!passwordMatches) {
      throw new HttpError('invalid username or password', 401);
    }

    const codeforcesCredential = await this.teacherWriter.findTeacherCodeforcesCredential(teacher.id);

    return {
      accessToken: this.accessTokenSigner.sign({
        sub: teacher.id,
        username: teacher.username,
      }),
      tokenType: 'Bearer' as const,
      expiresIn: this.tokenExpiresIn,
      teacher: toAuthTeacher(teacher, codeforcesCredential),
    };
  }
}
