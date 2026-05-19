import { TeacherRole } from '../../contracts/types.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';
import { toAuthTeacher, isUniqueViolation } from '../mappers/AuthMapper.js';
import type { JwtAccessTokenSigner } from '../../infrastructure/security/JwtAccessTokenSigner.js';
import type { BcryptPasswordHasher } from '../../infrastructure/security/BcryptPasswordHasher.js';
import type { TypeOrmTeacherWriter } from '../../infrastructure/persistence/typeorm/Writer.js';
import type { RegisterInput } from '../../contracts/types.js';

export class RegisterUseCase {
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
      role: TeacherRole.Teacher,
      is_active: true,
    });

    try {
      const savedTeacher = await this.teacherWriter.save(teacher);

      const topicBotConfig = await this.teacherWriter.saveTopicBotConfig(savedTeacher.id, {
        codeforces_api_key: input.codeforces_api_key,
        codeforces_api_secret: input.codeforces_api_secret,
      });

      return {
        accessToken: this.accessTokenSigner.sign({
          sub: savedTeacher.id,
          username: savedTeacher.username,
          role: savedTeacher.role,
        }),
        tokenType: 'Bearer' as const,
        expiresIn: this.tokenExpiresIn,
        teacher: toAuthTeacher(savedTeacher, topicBotConfig),
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError('username already exists', 409);
      }

      throw error;
    }
  }
}
