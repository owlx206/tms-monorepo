import type { AppModule } from '../module.types.js';
import { AttendanceUseCase } from './application/queries/AttendanceUseCase.js';
import { ClassScheduleUseCase as ClassScheduleQueryUseCase } from './application/queries/ClassScheduleUseCase.js';
import { ClassroomUseCase } from './application/queries/ClassroomUseCase.js';
import { SessionUseCase as SessionQueryUseCase } from './application/queries/SessionUseCase.js';
import { Attendance } from '../../entities/attendance.entity.js';
import { ClassSchedule } from '../../entities/class-schedule.entity.js';
import { Class } from '../../entities/class.entity.js';
import { TypeOrmClassCommandHandlers } from './infrastructure/persistence/typeorm/TypeOrmClassCommandHandlers.js';
import { TypeOrmAttendanceCommandHandlers } from './infrastructure/persistence/typeorm/TypeOrmAttendanceCommandHandlers.js';
import { TypeOrmAttendanceReader } from './infrastructure/persistence/typeorm/TypeOrmAttendanceReader.js';
import { TypeOrmClassReader } from './infrastructure/persistence/typeorm/TypeOrmClassReader.js';
import { TypeOrmClassScheduleCommandHandlers } from './infrastructure/persistence/typeorm/TypeOrmClassScheduleCommandHandlers.js';
import { TypeOrmClassScheduleReader } from './infrastructure/persistence/typeorm/TypeOrmClassScheduleReader.js';
import { TypeOrmSessionCommandHandlers } from './infrastructure/persistence/typeorm/TypeOrmSessionCommandHandlers.js';
import { TypeOrmSessionReader } from './infrastructure/persistence/typeorm/TypeOrmSessionReader.js';
import { Session } from '../../entities/session.entity.js';
import { ClassController } from './presentation/controllers/ClassController.js';
import { AttendanceController } from './presentation/controllers/AttendanceController.js';
import { ClassScheduleController } from './presentation/controllers/ClassScheduleController.js';
import { SessionController } from './presentation/controllers/SessionController.js';
import { createAttendanceRouter } from './presentation/routes/attendance.routes.js';
import { createClassScheduleRouter } from './presentation/routes/class-schedule.routes.js';
import { createClassroomRouter } from './presentation/routes/classroom.routes.js';
import { createSessionRouter } from './presentation/routes/session.routes.js';
import { AppDataSource } from '../../infrastructure/database/data-source.js';

const classCommandHandlers = new TypeOrmClassCommandHandlers();
const classScheduleCommandHandlers = new TypeOrmClassScheduleCommandHandlers();
const sessionCommandHandlers = new TypeOrmSessionCommandHandlers();
const attendanceCommandHandlers = new TypeOrmAttendanceCommandHandlers();
const classReader = new TypeOrmClassReader(AppDataSource.manager);
const classScheduleReader = new TypeOrmClassScheduleReader(AppDataSource.manager);
const sessionReader = new TypeOrmSessionReader(AppDataSource.manager);
const attendanceReader = new TypeOrmAttendanceReader(AppDataSource.manager);
const classroom = new ClassroomUseCase(classReader);
const classSchedules = new ClassScheduleQueryUseCase(classScheduleReader);
const sessions = new SessionQueryUseCase(sessionReader);
const attendance = new AttendanceUseCase(attendanceReader);

const classroomRouter = createClassroomRouter({
  listClasses: new ClassController('listClasses', {
    classroom,
    createClass: classCommandHandlers,
    updateClass: classCommandHandlers,
    archiveClass: classCommandHandlers,
  }),
  getClassById: new ClassController('getClassById', {
    classroom,
    createClass: classCommandHandlers,
    updateClass: classCommandHandlers,
    archiveClass: classCommandHandlers,
  }),
  getClassDetails: new ClassController('getClassDetails', {
    classroom,
    createClass: classCommandHandlers,
    updateClass: classCommandHandlers,
    archiveClass: classCommandHandlers,
  }),
  createClass: new ClassController('createClass', {
    classroom,
    createClass: classCommandHandlers,
    updateClass: classCommandHandlers,
    archiveClass: classCommandHandlers,
  }),
  updateClass: new ClassController('updateClass', {
    classroom,
    createClass: classCommandHandlers,
    updateClass: classCommandHandlers,
    archiveClass: classCommandHandlers,
  }),
  archiveClass: new ClassController('archiveClass', {
    classroom,
    createClass: classCommandHandlers,
    updateClass: classCommandHandlers,
    archiveClass: classCommandHandlers,
  }),
});

const classScheduleRouter = createClassScheduleRouter({
  listClassSchedules: new ClassScheduleController('listClassSchedules', {
    classSchedules,
    commandHandlers: classScheduleCommandHandlers,
  }),
  createClassSchedule: new ClassScheduleController('createClassSchedule', {
    classSchedules,
    commandHandlers: classScheduleCommandHandlers,
  }),
  updateClassSchedule: new ClassScheduleController('updateClassSchedule', {
    classSchedules,
    commandHandlers: classScheduleCommandHandlers,
  }),
  deleteClassSchedule: new ClassScheduleController('deleteClassSchedule', {
    classSchedules,
    commandHandlers: classScheduleCommandHandlers,
  }),
});

const sessionRouter = createSessionRouter({
  listSessions: new SessionController('listSessions', {
    sessions,
    commandHandlers: sessionCommandHandlers,
  }),
  listClassSessions: new SessionController('listClassSessions', {
    sessions,
    commandHandlers: sessionCommandHandlers,
  }),
  createManualSession: new SessionController('createManualSession', {
    sessions,
    commandHandlers: sessionCommandHandlers,
  }),
  cancelSession: new SessionController('cancelSession', {
    sessions,
    commandHandlers: sessionCommandHandlers,
  }),
});

const attendanceRouter = createAttendanceRouter({
  getSessionAttendance: new AttendanceController('getSessionAttendance', {
    attendance,
    commandHandlers: attendanceCommandHandlers,
  }),
  syncSessionAttendance: new AttendanceController('syncSessionAttendance', {
    attendance,
    commandHandlers: attendanceCommandHandlers,
  }),
  upsertSessionAttendance: new AttendanceController('upsertSessionAttendance', {
    attendance,
    commandHandlers: attendanceCommandHandlers,
  }),
  listAttendanceRecords: new AttendanceController('listAttendanceRecords', {
    attendance,
    commandHandlers: attendanceCommandHandlers,
  }),
  resetSessionAttendance: new AttendanceController('resetSessionAttendance', {
    attendance,
    commandHandlers: attendanceCommandHandlers,
  }),
});

export const classroomModule: AppModule = {
  name: 'classroom',
  entities: [Class, ClassSchedule, Session, Attendance],
  routes: [
    { path: '/', router: classroomRouter },
    { path: '/', router: classScheduleRouter },
    { path: '/', router: sessionRouter },
    { path: '/', router: attendanceRouter },
  ],
};
