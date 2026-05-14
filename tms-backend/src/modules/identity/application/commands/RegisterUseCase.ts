import { TeacherRole } from '../../../../entities/enums.js';
import { AuthError } from '../../../../shared/errors/auth.error.js';
import { toAuthTeacher, isUniqueViolation } from '../mappers/AuthMapper.js';
import type { JwtAccessTokenSigner } from '../../infrastructure/security/JwtAccessTokenSigner.js';
import type { BcryptPasswordHasher } from '../../infrastructure/security/BcryptPasswordHasher.js';
import type { TeacherRepository } from '../../infrastructure/persistence/typeorm/TeacherRepository.js';
import type { RegisterInput } from '../dto/AuthDto.js';

export class RegisterUseCase {
  constructor(
    private readonly teacherRepository: TeacherRepository,
    private readonly passwordHasher: BcryptPasswordHasher,
    private readonly accessTokenSigner: JwtAccessTokenSigner,
    private readonly tokenExpiresIn: string | undefined,
  ) {}

  async execute(input: RegisterInput) {
    const passwordHash = await this.passwordHasher.hash(input.password);

    const teacher = this.teacherRepository.create({
      username: input.username,
      password_hash: passwordHash,
      role: TeacherRole.Teacher,
      is_active: true,
      codeforces_handle: input.codeforces_handle,
      codeforces_api_key: input.codeforces_api_key,
      codeforces_api_secret: input.codeforces_api_secret,
    });

    try {
      const savedTeacher = await this.teacherRepository.save(teacher);

      return {
        accessToken: this.accessTokenSigner.sign({
          sub: savedTeacher.id,
          username: savedTeacher.username,
          role: savedTeacher.role,
        }),
        tokenType: 'Bearer' as const,
        expiresIn: this.tokenExpiresIn,
        teacher: toAuthTeacher(savedTeacher),
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AuthError('username already exists', 409);
      }

      throw error;
    }
  }
}
