import type { AppModule } from '../module.types.js';
import config from '../../config.js';
import { LoginUseCase } from './application/commands/LoginUseCase.js';
import { RegisterUseCase } from './application/commands/RegisterUseCase.js';
import { CompleteTeacherDiscordVerificationUseCase } from './application/commands/CompleteTeacherDiscordVerificationUseCase.js';
import { CompleteStudentDiscordAuthorizationUseCase } from './application/commands/CompleteStudentDiscordAuthorizationUseCase.js';
import { StartStudentDiscordAuthorizationUseCase } from './application/commands/StartStudentDiscordAuthorizationUseCase.js';
import { StartTeacherDiscordVerificationUseCase } from './application/commands/StartTeacherDiscordVerificationUseCase.js';
import { UpsertSysadminDiscordBotCredentialUseCase } from './application/commands/UpsertSysadminDiscordBotCredentialUseCase.js';
import { UpdateTeacherByAdminUseCase } from './application/commands/UpdateTeacherByAdminUseCase.js';
import { UpdateMyProfileUseCase } from './application/commands/UpdateMyProfileUseCase.js';
import { GetCurrentTeacherUseCase } from './application/queries/GetCurrentTeacherUseCase.js';
import { SysadminDiscordBotCredential } from './infrastructure/persistence/typeorm/entities/sysadmin-discord-bot-credential.entity.js';
import { TopicBotConfig } from '../topic/infrastructure/persistence/typeorm/entities/topic-bot-config.entity.js';
import { TypeOrmSysadminDiscordBotCredentialReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmSysadminDiscordBotCredentialStore } from './infrastructure/persistence/typeorm/Writer.js';
import { Teacher } from './infrastructure/persistence/typeorm/entities/teacher.entity.js';
import { TypeOrmTeacherReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmTeacherWriter } from './infrastructure/persistence/typeorm/Writer.js';
import { TypeOrmStudentDiscordIdentityStore } from './infrastructure/persistence/typeorm/Writer.js';
import { BcryptPasswordHasher } from './infrastructure/security/BcryptPasswordHasher.js';
import { JwtAccessTokenSigner } from './infrastructure/security/JwtAccessTokenSigner.js';
import { AdminController } from './presentation/controllers/AdminController.js';
import { AuthController } from './presentation/controllers/AuthController.js';
import { createAdminRouter } from './presentation/routes/admin.routes.js';
import { createAuthRouter } from './presentation/routes/auth.routes.js';

const teacherWriter = new TypeOrmTeacherWriter();
const teacherReader = new TypeOrmTeacherReader();
const studentDiscordIdentityStore = new TypeOrmStudentDiscordIdentityStore();
const discordBotCredentialStore = new TypeOrmSysadminDiscordBotCredentialStore();
const discordBotCredentialReader = new TypeOrmSysadminDiscordBotCredentialReader();
const passwordHasher = new BcryptPasswordHasher();
const accessTokenSigner = new JwtAccessTokenSigner();
const getCurrentTeacher = new GetCurrentTeacherUseCase();
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
const startTeacherDiscordVerificationUseCase = new StartTeacherDiscordVerificationUseCase(
  discordBotCredentialStore,
);
const completeTeacherDiscordVerificationUseCase = new CompleteTeacherDiscordVerificationUseCase(
  teacherWriter,
  discordBotCredentialStore,
);
const startStudentDiscordAuthorizationUseCase = new StartStudentDiscordAuthorizationUseCase(
  studentDiscordIdentityStore,
  discordBotCredentialStore,
);
const completeStudentDiscordAuthorizationUseCase = new CompleteStudentDiscordAuthorizationUseCase(
  studentDiscordIdentityStore,
  discordBotCredentialStore,
);
const upsertSysadminDiscordBotCredentialUseCase = new UpsertSysadminDiscordBotCredentialUseCase(
  discordBotCredentialStore,
);
const adminReadDependencies = {
  listTeachers: { execute: () => teacherReader.listAdminTeachers() },
  getDiscordBotCredential: { execute: () => discordBotCredentialReader.getDefaultView() },
};

const authRouter = createAuthRouter({
  register: new AuthController('register', {
    getCurrentTeacher,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
    startStudentDiscordAuthorization: startStudentDiscordAuthorizationUseCase,
    completeStudentDiscordAuthorization: completeStudentDiscordAuthorizationUseCase,
  }),
  login: new AuthController('login', {
    getCurrentTeacher,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
    startStudentDiscordAuthorization: startStudentDiscordAuthorizationUseCase,
    completeStudentDiscordAuthorization: completeStudentDiscordAuthorizationUseCase,
  }),
  me: new AuthController('me', {
    getCurrentTeacher,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
    startStudentDiscordAuthorization: startStudentDiscordAuthorizationUseCase,
    completeStudentDiscordAuthorization: completeStudentDiscordAuthorizationUseCase,
  }),
  updateMe: new AuthController('updateMe', {
    getCurrentTeacher,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
    startStudentDiscordAuthorization: startStudentDiscordAuthorizationUseCase,
    completeStudentDiscordAuthorization: completeStudentDiscordAuthorizationUseCase,
  }),
  startDiscordVerification: new AuthController('startDiscordVerification', {
    getCurrentTeacher,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
    startStudentDiscordAuthorization: startStudentDiscordAuthorizationUseCase,
    completeStudentDiscordAuthorization: completeStudentDiscordAuthorizationUseCase,
  }),
  completeDiscordVerification: new AuthController('completeDiscordVerification', {
    getCurrentTeacher,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
    startStudentDiscordAuthorization: startStudentDiscordAuthorizationUseCase,
    completeStudentDiscordAuthorization: completeStudentDiscordAuthorizationUseCase,
  }),
  startStudentDiscordAuthorization: new AuthController('startStudentDiscordAuthorization', {
    getCurrentTeacher,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
    startStudentDiscordAuthorization: startStudentDiscordAuthorizationUseCase,
    completeStudentDiscordAuthorization: completeStudentDiscordAuthorizationUseCase,
  }),
  completeStudentDiscordAuthorization: new AuthController('completeStudentDiscordAuthorization', {
    getCurrentTeacher,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
    startStudentDiscordAuthorization: startStudentDiscordAuthorizationUseCase,
    completeStudentDiscordAuthorization: completeStudentDiscordAuthorizationUseCase,
  }),
});

const adminRouter = createAdminRouter({
  listTeachers: new AdminController('listTeachers', {
    ...adminReadDependencies,
    updateTeacher: updateTeacherByAdminUseCase,
    upsertDiscordBotCredential: upsertSysadminDiscordBotCredentialUseCase,
  }),
  updateTeacher: new AdminController('updateTeacher', {
    ...adminReadDependencies,
    updateTeacher: updateTeacherByAdminUseCase,
    upsertDiscordBotCredential: upsertSysadminDiscordBotCredentialUseCase,
  }),
  getDiscordBotCredential: new AdminController('getDiscordBotCredential', {
    ...adminReadDependencies,
    updateTeacher: updateTeacherByAdminUseCase,
    upsertDiscordBotCredential: upsertSysadminDiscordBotCredentialUseCase,
  }),
  upsertDiscordBotCredential: new AdminController('upsertDiscordBotCredential', {
    ...adminReadDependencies,
    updateTeacher: updateTeacherByAdminUseCase,
    upsertDiscordBotCredential: upsertSysadminDiscordBotCredentialUseCase,
  }),
});

export const identityModule: AppModule = {
  name: 'identity',
  entities: [Teacher, SysadminDiscordBotCredential, TopicBotConfig],
  routes: [
    { path: '/', router: authRouter },
    { path: '/admin', router: adminRouter },
  ],
};
