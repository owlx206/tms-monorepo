import type { AppModule } from '../module.types.js';
import config from '../../config.js';
import { LoginUseCase } from './application/commands/LoginUseCase.js';
import { RegisterUseCase } from './application/commands/RegisterUseCase.js';
import { LinkTeacherDiscordUseCase } from './application/commands/LinkTeacherDiscordUseCase.js';
import { LinkStudentDiscordUseCase } from './application/commands/LinkStudentDiscordUseCase.js';
import { UpsertSysadminDiscordBotCredentialUseCase } from './application/commands/UpsertSysadminDiscordBotCredentialUseCase.js';
import { UpdateTeacherByAdminUseCase } from './application/commands/UpdateTeacherByAdminUseCase.js';
import { UpdateMyProfileUseCase } from './application/commands/UpdateMyProfileUseCase.js';
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
const registerUseCase = new RegisterUseCase(
  teacherWriter,
  passwordHasher,
  accessTokenSigner,
  config.auth.jwtExpiresIn,
);
const loginUseCase = new LoginUseCase(
  teacherWriter,
  passwordHasher,
  accessTokenSigner,
  config.auth.jwtExpiresIn,
);
const updateMyProfileUseCase = new UpdateMyProfileUseCase(teacherWriter, passwordHasher);
const updateTeacherByAdminUseCase = new UpdateTeacherByAdminUseCase(teacherWriter, passwordHasher);
const linkTeacherDiscordUseCase = new LinkTeacherDiscordUseCase(
  teacherWriter,
  discordBotCredentialStore,
);
const linkStudentDiscordUseCase = new LinkStudentDiscordUseCase(
  studentDiscordIdentityStore,
  discordBotCredentialStore,
);
const upsertSysadminDiscordBotCredentialUseCase = new UpsertSysadminDiscordBotCredentialUseCase(
  discordBotCredentialStore,
);

const authControllerDeps = {
  register: registerUseCase,
  login: loginUseCase,
  me: {
    execute: async (teacherId: number) => {
      const teacher = await teacherWriter.findById(teacherId);
      if (!teacher) {
        return null;
      }

      return toAuthTeacher(teacher, await teacherWriter.findTeacherCodeforcesCredential(teacherId));
    },
  },
  updateMe: updateMyProfileUseCase,
  linkTeacherDiscord: linkTeacherDiscordUseCase,
  linkStudentDiscord: linkStudentDiscordUseCase,
};

const adminReadDependencies = {
  listTeachers: { execute: () => teacherReader.listAdminTeachers() },
  getDiscordBotCredential: { execute: () => discordBotCredentialReader.getDefaultView() },
};
const adminWriteDependencies = {
  updateTeacher: updateTeacherByAdminUseCase,
  upsertDiscordBotCredential: upsertSysadminDiscordBotCredentialUseCase,
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
