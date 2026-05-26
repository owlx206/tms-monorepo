import type { AppModule } from '../module.types.js';
import { AppDataSource } from '../../infrastructure/database/data-source.js';
import { DiscordRecipientResolver, searchDiscordGuildMembers } from '../../infrastructure/external/discord/discord.js';
import { AuthorizeStudentDiscord } from './application/commands/AuthorizeStudentDiscord.js';
import { TypeOrmStudentDiscordIdentityStore, TypeOrmSysadminDiscordBotCredentialStore } from '../account/infrastructure/persistence/typeorm/Writer.js';
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
import { createStudentReportRouter } from './presentation/routes/student-report.routes.js';
import { createStudentRouter } from './presentation/routes/student.routes.js';

const discordBotCredentialStore = new TypeOrmSysadminDiscordBotCredentialStore();
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
const studentRouter = createStudentRouter(studentControllers);
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
const studentReportRouter = createStudentReportRouter(studentReportControllers);

export const studentModule: AppModule = {
  name: 'student',
  entities: [Student, Enrollment],
  routes: [
    { path: '/', router: studentRouter },
    { path: '/', router: studentReportRouter },
  ],
};
