import { Router } from 'express';
import passport from 'passport';

import type { AppModule } from '../module.types.js';
import { DiscordBotCredential } from '../../infrastructure/database/entities/discord-bot-credential.entity.js';
import { BcryptPasswordHasher } from '../../infrastructure/security/auth.js';
import { TeacherRole } from '../account/contracts/types.js';
import { TypeOrmTeacherReader } from '../account/infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmDiscordBotCredentialReader } from '../account/infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmTeacherWriter } from '../account/infrastructure/persistence/typeorm/Writer.js';
import { TypeOrmDiscordBotCredentialStore } from '../account/infrastructure/persistence/typeorm/Writer.js';
import { ConfigureDiscordBot } from './application/commands/ConfigureDiscordBot.js';
import { UpdateTeacher } from './application/commands/UpdateTeacher.js';
import { AdminController } from './presentation/controllers/AdminController.js';
import {
  teacherIdParamSchema,
  updateTeacherAccountBodySchema,
  upsertDiscordBotCredentialBodySchema,
} from './presentation/routes/admin.schema.js';
import { validate } from '../../shared/middlewares/validate.js';
import { attachRequestContext } from '../../infrastructure/http/request-context.js';
import { adaptExpressRoute } from '../../shared/presentation/adapt-express-route.js';
import { requireRoles } from '../../infrastructure/security/rbac.js';

const teacherWriter = new TypeOrmTeacherWriter();
const teacherReader = new TypeOrmTeacherReader();
const discordBotCredentialStore = new TypeOrmDiscordBotCredentialStore();
const discordBotCredentialReader = new TypeOrmDiscordBotCredentialReader();
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

const listTeachersController = new AdminController('listTeachers', {
  ...adminReadDependencies,
  ...adminWriteDependencies,
});
const updateTeacherController = new AdminController('updateTeacher', {
  ...adminReadDependencies,
  ...adminWriteDependencies,
});
const getDiscordBotCredentialController = new AdminController('getDiscordBotCredential', {
  ...adminReadDependencies,
  ...adminWriteDependencies,
});
const upsertDiscordBotCredentialController = new AdminController('upsertDiscordBotCredential', {
  ...adminReadDependencies,
  ...adminWriteDependencies,
});

const adminRouter = Router();
adminRouter.use(
  passport.authenticate('jwt', { session: false }),
  requireRoles([TeacherRole.Admin]),
  attachRequestContext(),
);
adminRouter.get('/teachers', adaptExpressRoute(listTeachersController));
adminRouter.get('/discord-bot', adaptExpressRoute(getDiscordBotCredentialController));
adminRouter.put(
  '/discord-bot',
  validate({ body: upsertDiscordBotCredentialBodySchema }),
  adaptExpressRoute(upsertDiscordBotCredentialController),
);
adminRouter.patch(
  '/teachers/:teacherId',
  validate({ params: teacherIdParamSchema, body: updateTeacherAccountBodySchema }),
  adaptExpressRoute(updateTeacherController),
);

export const systemModule: AppModule = {
  name: 'system',
  entities: [DiscordBotCredential],
  routes: [
    { path: '/admin', router: adminRouter },
  ],
};
