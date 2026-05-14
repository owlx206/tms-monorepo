import type { AppModule } from '../module.types.js';
import { AppDataSource } from '../../infrastructure/database/data-source.js';
import { createSysadminDiscordBotCredentialStore } from '../identity/index.js';
import { GetStudentByIdUseCase } from './application/queries/GetStudentByIdUseCase.js';
import { ListStudentsUseCase } from './application/queries/ListStudentsUseCase.js';
import { Enrollment } from '../../entities/enrollment.entity.js';
import { Student } from '../../entities/student.entity.js';
import { TypeOrmStudentDiscordMembershipService } from './infrastructure/persistence/typeorm/TypeOrmStudentDiscordMembershipService.js';
import { TypeOrmStudentCommandHandlers } from './infrastructure/persistence/typeorm/TypeOrmStudentCommandHandlers.js';
import { TypeOrmStudentReader } from './infrastructure/persistence/typeorm/TypeOrmStudentReader.js';
import { GetDashboardSummaryUseCase } from './application/queries/GetDashboardSummaryUseCase.js';
import { GetStudentLearningProfileUseCase } from './application/queries/GetStudentLearningProfileUseCase.js';
import { TypeOrmStudentReportReader } from './infrastructure/persistence/typeorm/TypeOrmStudentReportReader.js';
import { TypeOrmFinanceReportReader } from './infrastructure/persistence/typeorm/TypeOrmFinanceReportReader.js';
import { StudentController } from './presentation/controllers/StudentController.js';
import { StudentReportController } from './presentation/controllers/StudentReportController.js';
import { createStudentReportRouter } from './presentation/routes/student-report.routes.js';
import { createStudentRouter } from './presentation/routes/enrollment.routes.js';

const studentDiscordMembershipService = new TypeOrmStudentDiscordMembershipService(
  AppDataSource,
  createSysadminDiscordBotCredentialStore(),
);
const studentCommandHandlers = new TypeOrmStudentCommandHandlers(AppDataSource, studentDiscordMembershipService);
const studentReader = new TypeOrmStudentReader(AppDataSource.manager);
const studentControllerDependencies = {
  listStudents: new ListStudentsUseCase(studentReader),
  getStudentById: new GetStudentByIdUseCase(studentReader),
  createStudent: studentCommandHandlers.createStudent,
  updateStudent: studentCommandHandlers.updateStudent,
  inviteStudentToCurrentClass: studentCommandHandlers.inviteStudentToCurrentClass,
  transferStudent: studentCommandHandlers.transferStudent,
  bulkTransferStudents: studentCommandHandlers.bulkTransferStudents,
  withdrawStudent: studentCommandHandlers.withdrawStudent,
  bulkWithdrawStudents: studentCommandHandlers.bulkWithdrawStudents,
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
  bulkTransferStudents: new StudentController('bulkTransferStudents', studentControllerDependencies),
  withdrawStudent: new StudentController('withdrawStudent', studentControllerDependencies),
  bulkWithdrawStudents: new StudentController('bulkWithdrawStudents', studentControllerDependencies),
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
