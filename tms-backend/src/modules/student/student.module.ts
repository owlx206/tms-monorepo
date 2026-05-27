import { Router } from 'express';
import passport from 'passport';

import type { AppModule } from '../module.types.js';
import { TeacherRole } from '../account/contracts/types.js';
import { AppDataSource } from '../../infrastructure/database/data-source.js';
import { DiscordRecipientResolver, searchDiscordGuildMembers } from '../../infrastructure/external/discord/discord.js';
import { AuthorizeStudentDiscord } from './application/commands/AuthorizeStudentDiscord.js';
import { TypeOrmStudentDiscordIdentityStore, TypeOrmDiscordBotCredentialStore } from '../account/infrastructure/persistence/typeorm/Writer.js';
import { Enrollment } from '../../infrastructure/database/entities/enrollment.entity.js';
import { Student } from '../../infrastructure/database/entities/student.entity.js';
import { SendStudentMessages } from './application/commands/SendStudentMessages.js';
import { TypeOrmStudentDiscordMembershipService } from './infrastructure/persistence/typeorm/Writer.js';
import { TypeOrmStudentCommandHandlers } from './infrastructure/persistence/typeorm/Writer.js';
import { listStudentEnrollments, TypeOrmStudentReader } from './infrastructure/persistence/typeorm/Reader.js';
import { GetDashboardSummary } from './application/queries/GetDashboardSummary.js';
import { GetStudentLearningProfile } from './application/queries/GetStudentLearningProfile.js';
import { TypeOrmStudentReportReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmFinanceReportReader } from './infrastructure/persistence/typeorm/Reader.js';
import { StudentController } from './presentation/controllers/StudentController.js';
import { StudentReportController } from './presentation/controllers/StudentReportController.js';
import {
  archivePendingStudentBodySchema,
  createStudentBodySchema,
  reinstateStudentBodySchema,
  singleStudentMessageBodySchema,
  studentIdParamSchema,
  studentListQuerySchema,
  studentMessageBodySchema,
  transferStudentBodySchema,
  updateStudentBodySchema,
  withdrawStudentBodySchema,
} from './presentation/routes/student.schema.js';
import { studentIdParamSchema as studentReportIdParamSchema } from './presentation/routes/student-report.schema.js';
import { attachRequestContext } from '../../infrastructure/http/request-context.js';
import { authorizeOwnedClassBody, authorizeOwnedClassQuery, authorizeOwnedStudentBody, authorizeOwnedStudentParam } from '../../infrastructure/security/ownership.js';
import { requireRoles } from '../../infrastructure/security/rbac.js';
import { adaptExpressRoute } from '../../shared/presentation/adapt-express-route.js';
import { validate } from '../../shared/middlewares/validate.js';

const discordBotCredentialStore = new TypeOrmDiscordBotCredentialStore();
const studentDiscordIdentityStore = new TypeOrmStudentDiscordIdentityStore();
const studentDiscordMembershipService = new TypeOrmStudentDiscordMembershipService(
  AppDataSource,
  discordBotCredentialStore,
);
const discordRecipientResolver = new DiscordRecipientResolver(
  searchDiscordGuildMembers,
);
const authorizeStudentDiscord = new AuthorizeStudentDiscord(
  studentDiscordIdentityStore,
  discordBotCredentialStore,
);
const sendStudentMessages = new SendStudentMessages(
  discordBotCredentialStore,
  discordRecipientResolver,
);
const studentCommandHandlers = new TypeOrmStudentCommandHandlers(AppDataSource, studentDiscordMembershipService);
const studentReader = {
  listStudents: (...args: Parameters<TypeOrmStudentReader['listStudents']>) =>
    new TypeOrmStudentReader(AppDataSource.manager).listStudents(...args),
  getStudentById: (...args: Parameters<TypeOrmStudentReader['getStudentById']>) =>
    new TypeOrmStudentReader(AppDataSource.manager).getStudentById(...args),
  listStudentEnrollments,
};
const studentControllerDependencies = {
  students: studentReader,
  createStudent: studentCommandHandlers.createStudent,
  updateStudent: studentCommandHandlers.updateStudent,
  getStudentDiscordAuthorizationUrl: authorizeStudentDiscord,
  inviteStudentToCurrentClass: studentCommandHandlers.inviteStudentToCurrentClass,
  sendStudentMessages,
  transferStudent: studentCommandHandlers.transferStudent,
  withdrawStudent: studentCommandHandlers.withdrawStudent,
  reinstateStudent: studentCommandHandlers.reinstateStudent,
  archivePendingStudent: studentCommandHandlers.archivePendingStudent,
};
const studentControllers = {
  listStudents: new StudentController('listStudents', studentControllerDependencies),
  getStudentById: new StudentController('getStudentById', studentControllerDependencies),
  createStudent: new StudentController('createStudent', studentControllerDependencies),
  updateStudent: new StudentController('updateStudent', studentControllerDependencies),
  listStudentEnrollments: new StudentController('listStudentEnrollments', studentControllerDependencies),
  getStudentDiscordAuthorizationUrl: new StudentController('getStudentDiscordAuthorizationUrl', studentControllerDependencies),
  completeStudentDiscordAuthorization: new StudentController('completeStudentDiscordAuthorization', studentControllerDependencies),
  inviteStudentToCurrentClass: new StudentController('inviteStudentToCurrentClass', studentControllerDependencies),
  sendStudentMessage: new StudentController('sendStudentMessage', studentControllerDependencies),
  sendStudentMessages: new StudentController('sendStudentMessages', studentControllerDependencies),
  transferStudent: new StudentController('transferStudent', studentControllerDependencies),
  withdrawStudent: new StudentController('withdrawStudent', studentControllerDependencies),
  reinstateStudent: new StudentController('reinstateStudent', studentControllerDependencies),
  archivePendingStudent: new StudentController('archivePendingStudent', studentControllerDependencies),
};
const studentRouter = Router();
studentRouter.use(
  passport.authenticate('jwt', { session: false }),
  requireRoles([TeacherRole.Teacher]),
  attachRequestContext(),
);
studentRouter.get('/', validate({ query: studentListQuerySchema }), authorizeOwnedClassQuery(), adaptExpressRoute(studentControllers.listStudents));
studentRouter.post('/', validate({ body: createStudentBodySchema }), authorizeOwnedClassBody('class_id'), adaptExpressRoute(studentControllers.createStudent));
studentRouter.get('/:studentId', validate({ params: studentIdParamSchema }), authorizeOwnedStudentParam(), adaptExpressRoute(studentControllers.getStudentById));
studentRouter.patch('/:studentId', validate({
  body: updateStudentBodySchema,
  params: studentIdParamSchema,
}), authorizeOwnedStudentParam(), adaptExpressRoute(studentControllers.updateStudent));
studentRouter.get('/:studentId/enrollments', validate({ params: studentIdParamSchema }), authorizeOwnedStudentParam(), adaptExpressRoute(studentControllers.listStudentEnrollments));
studentRouter.get('/:studentId/discord/authorization-url', validate({ params: studentIdParamSchema }), authorizeOwnedStudentParam(), adaptExpressRoute(studentControllers.getStudentDiscordAuthorizationUrl));
studentRouter.post('/:studentId/discord/invite-current-class', validate({ params: studentIdParamSchema }), authorizeOwnedStudentParam(), adaptExpressRoute(studentControllers.inviteStudentToCurrentClass));
studentRouter.post('/:studentId/discord/message', validate({
  body: singleStudentMessageBodySchema,
  params: studentIdParamSchema,
}), authorizeOwnedStudentParam(), adaptExpressRoute(studentControllers.sendStudentMessage));
studentRouter.post('/discord/messages', validate({ body: studentMessageBodySchema }), authorizeOwnedClassBody('class_id'), authorizeOwnedStudentBody('student_ids'), adaptExpressRoute(studentControllers.sendStudentMessages));
studentRouter.post('/:studentId/transfer', validate({
  body: transferStudentBodySchema,
  params: studentIdParamSchema,
}), authorizeOwnedStudentParam(), authorizeOwnedClassBody('to_class_id'), adaptExpressRoute(studentControllers.transferStudent));
studentRouter.post('/:studentId/withdraw', validate({
  body: withdrawStudentBodySchema,
  params: studentIdParamSchema,
}), authorizeOwnedStudentParam(), adaptExpressRoute(studentControllers.withdrawStudent));
studentRouter.post('/:studentId/reinstate', validate({
  body: reinstateStudentBodySchema,
  params: studentIdParamSchema,
}), authorizeOwnedStudentParam(), authorizeOwnedClassBody('class_id'), adaptExpressRoute(studentControllers.reinstateStudent));
studentRouter.post('/:studentId/archive', validate({
  body: archivePendingStudentBodySchema,
  params: studentIdParamSchema,
}), authorizeOwnedStudentParam(), adaptExpressRoute(studentControllers.archivePendingStudent));

const studentDiscordCallbackRouter = Router();
studentDiscordCallbackRouter.get('/student/callback', adaptExpressRoute(studentControllers.completeStudentDiscordAuthorization));
const studentReportQueries = {
  getDashboardSummary: new GetDashboardSummary(
    new TypeOrmStudentReportReader(),
    new TypeOrmFinanceReportReader(),
  ),
  getStudentLearningProfile: new GetStudentLearningProfile(
    new TypeOrmStudentReportReader(),
    new TypeOrmFinanceReportReader(),
  ),
};
const studentReportControllers = {
  getDashboardSummary: new StudentReportController('getDashboardSummary', studentReportQueries),
  getStudentLearningProfile: new StudentReportController('getStudentLearningProfile', studentReportQueries),
};
const studentReportRouter = Router();
studentReportRouter.use(
  passport.authenticate('jwt', { session: false }),
  requireRoles([TeacherRole.Teacher]),
  attachRequestContext(),
);
studentReportRouter.get('/dashboard', adaptExpressRoute(studentReportControllers.getDashboardSummary));
studentReportRouter.get(
  '/students/:studentId/learning-profile',
  validate({ params: studentReportIdParamSchema }),
  authorizeOwnedStudentParam(),
  adaptExpressRoute(studentReportControllers.getStudentLearningProfile),
);

export const studentModule: AppModule = {
  name: 'student',
  entities: [Student, Enrollment],
  routes: [
    { path: '/students', router: studentRouter },
    { path: '/discord', router: studentDiscordCallbackRouter },
    { path: '/reporting', router: studentReportRouter },
  ],
};
