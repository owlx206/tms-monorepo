import type { AppModule } from '../module.types.js';
import { AppDataSource } from '../../infrastructure/database/data-source.js';
import { TypeOrmSysadminDiscordBotCredentialStore } from '../identity/infrastructure/persistence/typeorm/Writer.js';
import { Enrollment } from './infrastructure/persistence/typeorm/entities/enrollment.entity.js';
import { Student } from './infrastructure/persistence/typeorm/entities/student.entity.js';
import { TypeOrmStudentDiscordMembershipService } from './infrastructure/persistence/typeorm/Writer.js';
import { TypeOrmStudentCommandHandlers } from './infrastructure/persistence/typeorm/Writer.js';
import { TypeOrmStudentReader } from './infrastructure/persistence/typeorm/Reader.js';
import { GetDashboardSummaryUseCase } from './application/queries/GetDashboardSummaryUseCase.js';
import { GetStudentLearningProfileUseCase } from './application/queries/GetStudentLearningProfileUseCase.js';
import { TypeOrmStudentReportReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmFinanceReportReader } from './infrastructure/persistence/typeorm/Reader.js';
import { StudentController } from './presentation/controllers/StudentController.js';
import { StudentReportController } from './presentation/controllers/StudentReportController.js';
import { createStudentReportRouter } from './presentation/routes/student-report.routes.js';
import { createStudentRouter } from './presentation/routes/enrollment.routes.js';

const studentDiscordMembershipService = new TypeOrmStudentDiscordMembershipService(
  AppDataSource,
  new TypeOrmSysadminDiscordBotCredentialStore(),
);
const studentCommandHandlers = new TypeOrmStudentCommandHandlers(AppDataSource, studentDiscordMembershipService);
const studentReader = {
  listStudents: (...args: Parameters<TypeOrmStudentReader['listStudents']>) =>
    new TypeOrmStudentReader(AppDataSource.manager).listStudents(...args),
  getStudentById: (...args: Parameters<TypeOrmStudentReader['getStudentById']>) =>
    new TypeOrmStudentReader(AppDataSource.manager).getStudentById(...args),
};
const studentControllerDependencies = {
  students: studentReader,
  createStudent: studentCommandHandlers.createStudent,
  updateStudent: studentCommandHandlers.updateStudent,
  inviteStudentToCurrentClass: studentCommandHandlers.inviteStudentToCurrentClass,
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
  inviteStudentToCurrentClass: new StudentController('inviteStudentToCurrentClass', studentControllerDependencies),
  transferStudent: new StudentController('transferStudent', studentControllerDependencies),
  withdrawStudent: new StudentController('withdrawStudent', studentControllerDependencies),
  reinstateStudent: new StudentController('reinstateStudent', studentControllerDependencies),
  archivePendingStudent: new StudentController('archivePendingStudent', studentControllerDependencies),
};
const studentRouter = createStudentRouter(studentControllers);
const studentReportUseCases = {
  getDashboardSummary: new GetDashboardSummaryUseCase(
    new TypeOrmStudentReportReader(),
    new TypeOrmFinanceReportReader(),
  ),
  getStudentLearningProfile: new GetStudentLearningProfileUseCase(
    new TypeOrmStudentReportReader(),
    new TypeOrmFinanceReportReader(),
  ),
};
const studentReportControllers = {
  getDashboardSummary: new StudentReportController('getDashboardSummary', studentReportUseCases),
  getStudentLearningProfile: new StudentReportController('getStudentLearningProfile', studentReportUseCases),
};
const studentReportRouter = createStudentReportRouter(studentReportControllers);

export const enrollmentModule: AppModule = {
  name: 'enrollment',
  entities: [Student, Enrollment],
  routes: [
    { path: '/', router: studentRouter },
    { path: '/', router: studentReportRouter },
  ],
};
