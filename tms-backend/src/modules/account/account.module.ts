import { Router } from 'express';
import passport from 'passport';

import type { AppModule } from '../module.types.js';
import config from '../../config.js';
import { Login } from './application/commands/Login.js';
import { Register } from './application/commands/Register.js';
import { VerifyTeacherDiscord } from './application/commands/VerifyTeacherDiscord.js';
import { UpdateMyProfile } from './application/commands/UpdateMyProfile.js';
import { TeacherCodeforcesCredential } from '../../infrastructure/database/entities/teacher-codeforces-credential.entity.js';
import { StudentDiscordCredential } from '../../infrastructure/database/entities/student-discord-credential.entity.js';
import { TypeOrmDiscordBotCredentialStore } from './infrastructure/persistence/typeorm/Writer.js';
import { Teacher } from '../../infrastructure/database/entities/teacher.entity.js';
import { TypeOrmTeacherWriter } from './infrastructure/persistence/typeorm/Writer.js';
import { BcryptPasswordHasher, JwtAccessTokenSigner } from '../../infrastructure/security/auth.js';
import { AuthController } from './presentation/controllers/AuthController.js';
import { loginBodySchema, registerBodySchema, updateMeBodySchema } from './presentation/routes/auth.schema.js';
import { toAuthTeacher } from './application/mappers/AuthMapper.js';
import { validate } from '../../shared/middlewares/validate.js';
import { attachRequestContext } from '../../infrastructure/http/request-context.js';
import { adaptExpressRoute } from '../../shared/presentation/adapt-express-route.js';

const teacherWriter = new TypeOrmTeacherWriter();
const discordBotCredentialStore = new TypeOrmDiscordBotCredentialStore();
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

const registerController = new AuthController('register', authControllerDeps);
const loginController = new AuthController('login', authControllerDeps);
const meController = new AuthController('me', authControllerDeps);
const updateMeController = new AuthController('updateMe', authControllerDeps);
const startDiscordVerificationController = new AuthController('startDiscordVerification', authControllerDeps);
const completeDiscordVerificationController = new AuthController('completeDiscordVerification', authControllerDeps);

const authRouter = Router();
authRouter.post('/register', validate({ body: registerBodySchema }), adaptExpressRoute(registerController));
authRouter.post('/login', validate({ body: loginBodySchema }), adaptExpressRoute(loginController));
authRouter.get('/discord/verification/callback', adaptExpressRoute(completeDiscordVerificationController));
authRouter.get(
  '/me',
  passport.authenticate('jwt', { session: false }),
  attachRequestContext(),
  adaptExpressRoute(meController),
);
authRouter.get(
  '/me/discord/verification/start',
  passport.authenticate('jwt', { session: false }),
  attachRequestContext(),
  adaptExpressRoute(startDiscordVerificationController),
);
authRouter.patch(
  '/me',
  passport.authenticate('jwt', { session: false }),
  attachRequestContext(),
  validate({ body: updateMeBodySchema }),
  adaptExpressRoute(updateMeController),
);

export const accountModule: AppModule = {
  name: 'account',
  entities: [Teacher, TeacherCodeforcesCredential, StudentDiscordCredential],
  routes: [
    { path: '/', router: authRouter },
  ],
};
