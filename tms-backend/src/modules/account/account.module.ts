import type { AppModule } from '../module.types.js';
import config from '../../config.js';
import { Login } from './application/commands/Login.js';
import { Register } from './application/commands/Register.js';
import { VerifyTeacherDiscord } from './application/commands/VerifyTeacherDiscord.js';
import { UpdateMyProfile } from './application/commands/UpdateMyProfile.js';
import { TeacherCodeforcesCredential } from '../../infrastructure/database/entities/teacher-codeforces-credential.entity.js';
import { StudentDiscordCredential } from '../../infrastructure/database/entities/student-discord-credential.entity.js';
import { TypeOrmSysadminDiscordBotCredentialStore } from './infrastructure/persistence/typeorm/Writer.js';
import { Teacher } from '../../infrastructure/database/entities/teacher.entity.js';
import { TypeOrmTeacherWriter } from './infrastructure/persistence/typeorm/Writer.js';
import { BcryptPasswordHasher, JwtAccessTokenSigner } from '../../infrastructure/security/auth.js';
import { AuthController } from './presentation/controllers/AuthController.js';
import { createAuthRouter } from './presentation/routes/auth.routes.js';
import { toAuthTeacher } from './application/mappers/AuthMapper.js';

const teacherWriter = new TypeOrmTeacherWriter();
const discordBotCredentialStore = new TypeOrmSysadminDiscordBotCredentialStore();
const passwordHasher = new BcryptPasswordHasher();
const accessTokenSigner = new JwtAccessTokenSigner();
const register = new Register(
  teacherWriter,
  passwordHasher,
  accessTokenSigner,
  config.auth.jwtExpiresIn,
);
const login = new Login(
  teacherWriter,
  passwordHasher,
  accessTokenSigner,
  config.auth.jwtExpiresIn,
);
const updateMyProfile = new UpdateMyProfile(teacherWriter, passwordHasher);
const verifyTeacherDiscord = new VerifyTeacherDiscord(
  teacherWriter,
  discordBotCredentialStore,
);

const authControllerDeps = {
  register,
  login,
  me: {
    execute: async (teacherId: number) => {
      const teacher = await teacherWriter.findById(teacherId);
      if (!teacher) {
        return null;
      }

      return toAuthTeacher(teacher, await teacherWriter.findTeacherCodeforcesCredential(teacherId));
    },
  },
  updateMe: updateMyProfile,
  linkTeacherDiscord: verifyTeacherDiscord,
};

const authRouter = createAuthRouter({
  register: new AuthController('register', authControllerDeps),
  login: new AuthController('login', authControllerDeps),
  me: new AuthController('me', authControllerDeps),
  updateMe: new AuthController('updateMe', authControllerDeps),
  startDiscordVerification: new AuthController('startDiscordVerification', authControllerDeps),
  completeDiscordVerification: new AuthController('completeDiscordVerification', authControllerDeps),
});

export const accountModule: AppModule = {
  name: 'account',
  entities: [Teacher, TeacherCodeforcesCredential, StudentDiscordCredential],
  routes: [
    { path: '/', router: authRouter },
  ],
};
