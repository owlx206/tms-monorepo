import type { AppModule } from '../module.types.js';
import config from '../../config.js';
import { Login } from './application/commands/Login.js';
import { Register } from './application/commands/Register.js';
import { VerifyTeacherDiscord } from './application/commands/VerifyTeacherDiscord.js';
import { AuthorizeStudentDiscord } from './application/commands/AuthorizeStudentDiscord.js';
import { ConfigureDiscordBot } from './application/commands/ConfigureDiscordBot.js';
import { UpdateTeacher } from './application/commands/UpdateTeacher.js';
import { UpdateMyProfile } from './application/commands/UpdateMyProfile.js';
import { SysadminDiscordBotCredential } from '../../infrastructure/database/entities/sysadmin-discord-bot-credential.entity.js';
import { TeacherCodeforcesCredential } from '../../infrastructure/database/entities/teacher-codeforces-credential.entity.js';
import { StudentDiscordCredential } from '../../infrastructure/database/entities/student-discord-credential.entity.js';
import { TypeOrmSysadminDiscordBotCredentialReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmSysadminDiscordBotCredentialStore } from './infrastructure/persistence/typeorm/Writer.js';
import { Teacher } from '../../infrastructure/database/entities/teacher.entity.js';
import { TypeOrmTeacherReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmTeacherWriter } from './infrastructure/persistence/typeorm/Writer.js';
import { TypeOrmStudentDiscordIdentityStore } from './infrastructure/persistence/typeorm/Writer.js';
import { BcryptPasswordHasher, JwtAccessTokenSigner } from './infrastructure/security.js';
import { AdminController } from './presentation/controllers/AdminController.js';
import { AuthController } from './presentation/controllers/AuthController.js';
import { createAdminRouter } from './presentation/routes/admin.routes.js';
import { createAuthRouter } from './presentation/routes/auth.routes.js';
import { toAuthTeacher } from './application/mappers/AuthMapper.js';

const teacherWriter = new TypeOrmTeacherWriter();
const teacherReader = new TypeOrmTeacherReader();
const studentDiscordIdentityStore = new TypeOrmStudentDiscordIdentityStore();
const discordBotCredentialStore = new TypeOrmSysadminDiscordBotCredentialStore();
const discordBotCredentialReader = new TypeOrmSysadminDiscordBotCredentialReader();
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
const updateTeacher = new UpdateTeacher(teacherWriter, passwordHasher);
const verifyTeacherDiscord = new VerifyTeacherDiscord(
  teacherWriter,
  discordBotCredentialStore,
);
const authorizeStudentDiscord = new AuthorizeStudentDiscord(
  studentDiscordIdentityStore,
  discordBotCredentialStore,
);
const configureDiscordBot = new ConfigureDiscordBot(
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
  linkStudentDiscord: authorizeStudentDiscord,
};

const adminReadDependencies = {
  listTeachers: { execute: () => teacherReader.listAdminTeachers() },
  getDiscordBotCredential: { execute: () => discordBotCredentialReader.getDefaultView() },
};
const adminWriteDependencies = {
  updateTeacher,
  upsertDiscordBotCredential: configureDiscordBot,
};

const authRouter = createAuthRouter({
  register: new AuthController('register', authControllerDeps),
  login: new AuthController('login', authControllerDeps),
  me: new AuthController('me', authControllerDeps),
  updateMe: new AuthController('updateMe', authControllerDeps),
  startDiscordVerification: new AuthController('startDiscordVerification', authControllerDeps),
  completeDiscordVerification: new AuthController('completeDiscordVerification', authControllerDeps),
  completeStudentDiscordAuthorization: new AuthController('completeStudentDiscordAuthorization', authControllerDeps),
});

const adminRouter = createAdminRouter({
  listTeachers: new AdminController('listTeachers', {
    ...adminReadDependencies,
    ...adminWriteDependencies,
  }),
  updateTeacher: new AdminController('updateTeacher', {
    ...adminReadDependencies,
    ...adminWriteDependencies,
  }),
  getDiscordBotCredential: new AdminController('getDiscordBotCredential', {
    ...adminReadDependencies,
    ...adminWriteDependencies,
  }),
  upsertDiscordBotCredential: new AdminController('upsertDiscordBotCredential', {
    ...adminReadDependencies,
    ...adminWriteDependencies,
  }),
});

export const identityModule: AppModule = {
  name: 'identity',
  entities: [Teacher, SysadminDiscordBotCredential, TeacherCodeforcesCredential, StudentDiscordCredential],
  routes: [
    { path: '/', router: authRouter },
    { path: '/admin', router: adminRouter },
  ],
};
