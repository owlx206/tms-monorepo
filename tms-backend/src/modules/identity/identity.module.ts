import type { AppModule } from '../module.types.js';
import config from '../../config.js';
import { CreateTeacherByAdminUseCase } from './application/commands/CreateTeacherByAdminUseCase.js';
import { LoginUseCase } from './application/commands/LoginUseCase.js';
import { RegisterUseCase } from './application/commands/RegisterUseCase.js';
import { CompleteTeacherDiscordVerificationUseCase } from './application/commands/CompleteTeacherDiscordVerificationUseCase.js';
import { StartTeacherDiscordVerificationUseCase } from './application/commands/StartTeacherDiscordVerificationUseCase.js';
import { UpsertSysadminDiscordBotCredentialUseCase } from './application/commands/UpsertSysadminDiscordBotCredentialUseCase.js';
import { UpdateTeacherByAdminUseCase } from './application/commands/UpdateTeacherByAdminUseCase.js';
import { UpdateMyProfileUseCase } from './application/commands/UpdateMyProfileUseCase.js';
import { ListTeachersUseCase } from './application/queries/ListTeachersUseCase.js';
import { GetCurrentTeacherUseCase } from './application/queries/GetCurrentTeacherUseCase.js';
import { GetSysadminDiscordBotCredentialUseCase } from './application/queries/GetSysadminDiscordBotCredentialUseCase.js';
import { SysadminDiscordBotCredential } from '../../entities/sysadmin-discord-bot-credential.entity.js';
import { TypeOrmSysadminDiscordBotCredentialStore } from './infrastructure/persistence/typeorm/TypeOrmSysadminDiscordBotCredentialStore.js';
import { Teacher } from '../../entities/teacher.entity.js';
import { TypeOrmTeacherWriter } from './infrastructure/persistence/typeorm/TypeOrmTeacherWriter.js';
import { BcryptPasswordHasher } from './infrastructure/security/BcryptPasswordHasher.js';
import { JwtAccessTokenSigner } from './infrastructure/security/JwtAccessTokenSigner.js';
import { AdminController } from './presentation/controllers/AdminController.js';
import { AuthController } from './presentation/controllers/AuthController.js';
import { createAdminRouter } from './presentation/routes/admin.routes.js';
import { createAuthRouter } from './presentation/routes/auth.routes.js';

const teacherWriter = new TypeOrmTeacherWriter();
const discordBotCredentialStore = new TypeOrmSysadminDiscordBotCredentialStore();
const passwordHasher = new BcryptPasswordHasher();
const accessTokenSigner = new JwtAccessTokenSigner();
const getCurrentTeacher = new GetCurrentTeacherUseCase();
const listTeachers = new ListTeachersUseCase(teacherWriter);
const getDiscordBotCredential = new GetSysadminDiscordBotCredentialUseCase(discordBotCredentialStore);
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
const createTeacherByAdminUseCase = new CreateTeacherByAdminUseCase(teacherWriter, passwordHasher);
const updateTeacherByAdminUseCase = new UpdateTeacherByAdminUseCase(teacherWriter, passwordHasher);
const startTeacherDiscordVerificationUseCase = new StartTeacherDiscordVerificationUseCase(
  discordBotCredentialStore,
);
const completeTeacherDiscordVerificationUseCase = new CompleteTeacherDiscordVerificationUseCase(
  teacherWriter,
  discordBotCredentialStore,
);
const upsertSysadminDiscordBotCredentialUseCase = new UpsertSysadminDiscordBotCredentialUseCase(
  discordBotCredentialStore,
);

const authRouter = createAuthRouter({
  register: new AuthController('register', {
    getCurrentTeacher,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
  }),
  login: new AuthController('login', {
    getCurrentTeacher,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
  }),
  me: new AuthController('me', {
    getCurrentTeacher,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
  }),
  updateMe: new AuthController('updateMe', {
    getCurrentTeacher,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
  }),
  startDiscordVerification: new AuthController('startDiscordVerification', {
    getCurrentTeacher,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
  }),
  completeDiscordVerification: new AuthController('completeDiscordVerification', {
    getCurrentTeacher,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
  }),
});

const adminRouter = createAdminRouter({
  listTeachers: new AdminController('listTeachers', {
    listTeachers,
    getDiscordBotCredential,
    createTeacher: createTeacherByAdminUseCase,
    updateTeacher: updateTeacherByAdminUseCase,
    upsertDiscordBotCredential: upsertSysadminDiscordBotCredentialUseCase,
  }),
  createTeacher: new AdminController('createTeacher', {
    listTeachers,
    getDiscordBotCredential,
    createTeacher: createTeacherByAdminUseCase,
    updateTeacher: updateTeacherByAdminUseCase,
    upsertDiscordBotCredential: upsertSysadminDiscordBotCredentialUseCase,
  }),
  updateTeacher: new AdminController('updateTeacher', {
    listTeachers,
    getDiscordBotCredential,
    createTeacher: createTeacherByAdminUseCase,
    updateTeacher: updateTeacherByAdminUseCase,
    upsertDiscordBotCredential: upsertSysadminDiscordBotCredentialUseCase,
  }),
  getDiscordBotCredential: new AdminController('getDiscordBotCredential', {
    listTeachers,
    getDiscordBotCredential,
    createTeacher: createTeacherByAdminUseCase,
    updateTeacher: updateTeacherByAdminUseCase,
    upsertDiscordBotCredential: upsertSysadminDiscordBotCredentialUseCase,
  }),
  upsertDiscordBotCredential: new AdminController('upsertDiscordBotCredential', {
    listTeachers,
    getDiscordBotCredential,
    createTeacher: createTeacherByAdminUseCase,
    updateTeacher: updateTeacherByAdminUseCase,
    upsertDiscordBotCredential: upsertSysadminDiscordBotCredentialUseCase,
  }),
});

export const identityModule: AppModule = {
  name: 'identity',
  entities: [Teacher, SysadminDiscordBotCredential],
  routes: [
    { path: '/', router: authRouter },
    { path: '/admin', router: adminRouter },
  ],
};
