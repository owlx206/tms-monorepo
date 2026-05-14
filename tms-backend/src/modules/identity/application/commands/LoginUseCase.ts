import { AuthError } from '../../../../shared/errors/auth.error.js';
import { toAuthTeacher } from '../mappers/AuthMapper.js';
import type { LoginInput } from '../dto/AuthDto.js';
import type { TeacherRepository } from '../../infrastructure/persistence/typeorm/TeacherRepository.js';
import type { JwtAccessTokenSigner } from '../../infrastructure/security/JwtAccessTokenSigner.js';
import type { BcryptPasswordHasher } from '../../infrastructure/security/BcryptPasswordHasher.js';

export class LoginUseCase {
  constructor(
    private readonly teacherRepository: TeacherRepository,
    private readonly passwordHasher: BcryptPasswordHasher,
    private readonly accessTokenSigner: JwtAccessTokenSigner,
    private readonly tokenExpiresIn: string | undefined,
  ) {}

  async execute(input: LoginInput) {
    const teacher = await this.teacherRepository.findByUsername(input.username);

    if (!teacher) {
      throw new AuthError('invalid username or password', 401);
    }

    if (!teacher.is_active) {
      throw new AuthError('account is inactive', 403);
    }

    const passwordMatches = await this.passwordHasher.compare(input.password, teacher.password_hash);
    if (!passwordMatches) {
      throw new AuthError('invalid username or password', 401);
    }

    return {
      accessToken: this.accessTokenSigner.sign({
        sub: teacher.id,
        username: teacher.username,
        role: teacher.role,
      }),
      tokenType: 'Bearer' as const,
      expiresIn: this.tokenExpiresIn,
      teacher: toAuthTeacher(teacher),
    };
  }
}
