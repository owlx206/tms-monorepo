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
import { AdminTeacherReadService } from './application/queries/AdminTeacherReadService.js';
import { AuthReadService } from './application/queries/AuthReadService.js';
import { SysadminDiscordBotCredentialReadService } from './application/queries/SysadminDiscordBotCredentialReadService.js';
import { SysadminDiscordBotCredentialOrmEntity } from './infrastructure/persistence/typeorm/SysadminDiscordBotCredentialOrmEntity.js';
import { TypeOrmSysadminDiscordBotCredentialStore } from './infrastructure/persistence/typeorm/TypeOrmSysadminDiscordBotCredentialStore.js';
import { TeacherOrmEntity } from './infrastructure/persistence/typeorm/TeacherOrmEntity.js';
import { TypeOrmTeacherRepository } from './infrastructure/persistence/typeorm/TypeOrmTeacherRepository.js';
import { BcryptPasswordHasher } from './infrastructure/security/BcryptPasswordHasher.js';
import { JwtAccessTokenSigner } from './infrastructure/security/JwtAccessTokenSigner.js';
import { AdminController } from './presentation/controllers/AdminController.js';
import { AuthController } from './presentation/controllers/AuthController.js';
import { createAdminRouter } from './presentation/routes/admin.routes.js';
import { createAuthRouter } from './presentation/routes/auth.routes.js';

const teacherRepository = new TypeOrmTeacherRepository();
const discordBotCredentialStore = new TypeOrmSysadminDiscordBotCredentialStore();
const passwordHasher = new BcryptPasswordHasher();
const accessTokenSigner = new JwtAccessTokenSigner();
const authReadService = new AuthReadService();
const adminTeacherReadService = new AdminTeacherReadService(teacherRepository);
const discordBotCredentialReadService = new SysadminDiscordBotCredentialReadService(discordBotCredentialStore);
const registerUseCase = new RegisterUseCase(
  teacherRepository,
  passwordHasher,
  accessTokenSigner,
  config.auth.jwtExpiresIn,
);
const loginUseCase = new LoginUseCase(
  teacherRepository,
  passwordHasher,
  accessTokenSigner,
  config.auth.jwtExpiresIn,
);
const updateMyProfileUseCase = new UpdateMyProfileUseCase(teacherRepository, passwordHasher);
const createTeacherByAdminUseCase = new CreateTeacherByAdminUseCase(teacherRepository, passwordHasher);
const updateTeacherByAdminUseCase = new UpdateTeacherByAdminUseCase(teacherRepository, passwordHasher);
const startTeacherDiscordVerificationUseCase = new StartTeacherDiscordVerificationUseCase(
  discordBotCredentialStore,
);
const completeTeacherDiscordVerificationUseCase = new CompleteTeacherDiscordVerificationUseCase(
  teacherRepository,
  discordBotCredentialStore,
);
const upsertSysadminDiscordBotCredentialUseCase = new UpsertSysadminDiscordBotCredentialUseCase(
  discordBotCredentialStore,
);

const authRouter = createAuthRouter({
  register: new AuthController('register', {
    readService: authReadService,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
  }),
  login: new AuthController('login', {
    readService: authReadService,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
  }),
  me: new AuthController('me', {
    readService: authReadService,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
  }),
  updateMe: new AuthController('updateMe', {
    readService: authReadService,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
  }),
  startDiscordVerification: new AuthController('startDiscordVerification', {
    readService: authReadService,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
  }),
  completeDiscordVerification: new AuthController('completeDiscordVerification', {
    readService: authReadService,
    register: registerUseCase,
    login: loginUseCase,
    updateMe: updateMyProfileUseCase,
    startDiscordVerification: startTeacherDiscordVerificationUseCase,
    completeDiscordVerification: completeTeacherDiscordVerificationUseCase,
  }),
});

const adminRouter = createAdminRouter({
  listTeachers: new AdminController('listTeachers', {
    readService: adminTeacherReadService,
    discordBotReadService: discordBotCredentialReadService,
    createTeacher: createTeacherByAdminUseCase,
    updateTeacher: updateTeacherByAdminUseCase,
    upsertDiscordBotCredential: upsertSysadminDiscordBotCredentialUseCase,
  }),
  createTeacher: new AdminController('createTeacher', {
    readService: adminTeacherReadService,
    discordBotReadService: discordBotCredentialReadService,
    createTeacher: createTeacherByAdminUseCase,
    updateTeacher: updateTeacherByAdminUseCase,
    upsertDiscordBotCredential: upsertSysadminDiscordBotCredentialUseCase,
  }),
  updateTeacher: new AdminController('updateTeacher', {
    readService: adminTeacherReadService,
    discordBotReadService: discordBotCredentialReadService,
    createTeacher: createTeacherByAdminUseCase,
    updateTeacher: updateTeacherByAdminUseCase,
    upsertDiscordBotCredential: upsertSysadminDiscordBotCredentialUseCase,
  }),
  getDiscordBotCredential: new AdminController('getDiscordBotCredential', {
    readService: adminTeacherReadService,
    discordBotReadService: discordBotCredentialReadService,
    createTeacher: createTeacherByAdminUseCase,
    updateTeacher: updateTeacherByAdminUseCase,
    upsertDiscordBotCredential: upsertSysadminDiscordBotCredentialUseCase,
  }),
  upsertDiscordBotCredential: new AdminController('upsertDiscordBotCredential', {
    readService: adminTeacherReadService,
    discordBotReadService: discordBotCredentialReadService,
    createTeacher: createTeacherByAdminUseCase,
    updateTeacher: updateTeacherByAdminUseCase,
    upsertDiscordBotCredential: upsertSysadminDiscordBotCredentialUseCase,
  }),
});

export const identityModule: AppModule = {
  name: 'identity',
  entities: [TeacherOrmEntity, SysadminDiscordBotCredentialOrmEntity],
  routes: [
    { path: '/', router: authRouter },
    { path: '/admin', router: adminRouter },
  ],
};
