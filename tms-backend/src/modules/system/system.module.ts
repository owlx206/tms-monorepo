import type { AppModule } from '../module.types.js';
import { SysadminDiscordBotCredential } from '../../infrastructure/database/entities/sysadmin-discord-bot-credential.entity.js';
import { BcryptPasswordHasher } from '../../infrastructure/security/auth.js';
import { TypeOrmTeacherReader } from '../account/infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmSysadminDiscordBotCredentialReader } from '../account/infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmTeacherWriter } from '../account/infrastructure/persistence/typeorm/Writer.js';
import { TypeOrmSysadminDiscordBotCredentialStore } from '../account/infrastructure/persistence/typeorm/Writer.js';
import { ConfigureDiscordBot } from './application/commands/ConfigureDiscordBot.js';
import { UpdateTeacher } from './application/commands/UpdateTeacher.js';
import { AdminController } from './presentation/controllers/AdminController.js';
import { createAdminRouter } from './presentation/routes/admin.routes.js';

const teacherWriter = new TypeOrmTeacherWriter();
const teacherReader = new TypeOrmTeacherReader();
const discordBotCredentialStore = new TypeOrmSysadminDiscordBotCredentialStore();
const discordBotCredentialReader = new TypeOrmSysadminDiscordBotCredentialReader();
const passwordHasher = new BcryptPasswordHasher();
const updateTeacher = new UpdateTeacher(teacherWriter, passwordHasher);
const configureDiscordBot = new ConfigureDiscordBot(discordBotCredentialStore);

const adminReadDependencies = {
  listTeachers: { execute: () => teacherReader.listTeacherAccounts() },
  getDiscordBotCredential: { execute: () => discordBotCredentialReader.getDefaultView() },
};

const adminWriteDependencies = {
  updateTeacher,
  upsertDiscordBotCredential: configureDiscordBot,
};

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

export const systemModule: AppModule = {
  name: 'system',
  entities: [SysadminDiscordBotCredential],
  routes: [
    { path: '/admin', router: adminRouter },
  ],
};
