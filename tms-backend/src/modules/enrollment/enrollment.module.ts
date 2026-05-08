import type { AppModule } from '../module.types.js';
import { AppDataSource } from '../../data-source.js';
import { createSysadminDiscordBotCredentialStore } from '../identity/index.js';
import { StudentReadService } from './application/queries/StudentReadService.js';
import { Enrollment } from './infrastructure/persistence/typeorm/EnrollmentOrmEntity.js';
import { Student } from './infrastructure/persistence/typeorm/StudentOrmEntity.js';
import { TypeOrmStudentCommunityPort } from './infrastructure/persistence/typeorm/TypeOrmStudentCommunityPort.js';
import { TypeOrmStudentCommandHandlers } from './infrastructure/persistence/typeorm/TypeOrmStudentCommandHandlers.js';
import { TypeOrmStudentReadRepository } from './infrastructure/persistence/typeorm/TypeOrmStudentReadRepository.js';
import { GetDashboardSummaryUseCase } from './application/queries/GetDashboardSummaryUseCase.js';
import { GetStudentLearningProfileUseCase } from './application/queries/GetStudentLearningProfileUseCase.js';
import { TypeOrmStudentReportReadRepository } from './infrastructure/persistence/typeorm/TypeOrmStudentReportReadRepository.js';
import { TypeOrmFinanceReportingPort } from './infrastructure/persistence/typeorm/TypeOrmFinanceReportingPort.js';
import { StudentController } from './presentation/controllers/StudentController.js';
import { StudentReportController } from './presentation/controllers/StudentReportController.js';
import { createStudentReportRouter } from './presentation/routes/student-report.routes.js';
import { createStudentRouter } from './presentation/routes/enrollment.routes.js';

const studentCommunityPort = new TypeOrmStudentCommunityPort(
  AppDataSource,
  createSysadminDiscordBotCredentialStore(),
);
const studentCommandHandlers = new TypeOrmStudentCommandHandlers(AppDataSource, studentCommunityPort);
const studentControllerDependencies = {
  readService: new StudentReadService(
    new TypeOrmStudentReadRepository(AppDataSource.manager),
  ),
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
const studentReportQueries = {
  getDashboardSummary: new GetDashboardSummaryUseCase(
    new TypeOrmStudentReportReadRepository(),
    new TypeOrmFinanceReportingPort(),
  ),
  getStudentLearningProfile: new GetStudentLearningProfileUseCase(
    new TypeOrmStudentReportReadRepository(),
    new TypeOrmFinanceReportingPort(),
  ),
};
const studentReportControllers = {
  getDashboardSummary: new StudentReportController('getDashboardSummary', studentReportQueries),
  getStudentLearningProfile: new StudentReportController('getStudentLearningProfile', studentReportQueries),
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
