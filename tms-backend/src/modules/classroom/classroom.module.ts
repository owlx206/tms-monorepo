import type { AppModule } from '../module.types.js';
import { Attendance } from './infrastructure/persistence/typeorm/entities/attendance.entity.js';
import { ClassSchedule } from './infrastructure/persistence/typeorm/entities/class-schedule.entity.js';
import { Class } from './infrastructure/persistence/typeorm/entities/class.entity.js';
import { TypeOrmClassCommandHandlers } from './infrastructure/persistence/typeorm/Writer.js';
import { TypeOrmAttendanceCommandHandlers } from './infrastructure/persistence/typeorm/Writer.js';
import { TypeOrmAttendanceReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmClassReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmClassScheduleReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmSessionCommandHandlers } from './infrastructure/persistence/typeorm/Writer.js';
import { TypeOrmSessionReader } from './infrastructure/persistence/typeorm/Reader.js';
import { Session } from './infrastructure/persistence/typeorm/entities/session.entity.js';
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
const sessionCommandHandlers = new TypeOrmSessionCommandHandlers();
const attendanceCommandHandlers = new TypeOrmAttendanceCommandHandlers();
const classReader = {
  listClasses: (...args: Parameters<TypeOrmClassReader['listClasses']>) =>
    new TypeOrmClassReader(AppDataSource.manager).listClasses(...args),
  getClassById: (...args: Parameters<TypeOrmClassReader['getClassById']>) =>
    new TypeOrmClassReader(AppDataSource.manager).getClassById(...args),
  getClassDetails: (...args: Parameters<TypeOrmClassReader['getClassDetails']>) =>
    new TypeOrmClassReader(AppDataSource.manager).getClassDetails(...args),
};
const classScheduleReader = {
  listClassSchedules: (...args: Parameters<TypeOrmClassScheduleReader['listClassSchedules']>) =>
    new TypeOrmClassScheduleReader(AppDataSource.manager).listClassSchedules(...args),
};
const sessionReader = {
  listSessions: (...args: Parameters<TypeOrmSessionReader['listSessions']>) =>
    new TypeOrmSessionReader(AppDataSource.manager).listSessions(...args),
};
const attendanceReader = {
  getSessionAttendance: (...args: Parameters<TypeOrmAttendanceReader['getSessionAttendance']>) =>
    new TypeOrmAttendanceReader(AppDataSource.manager).getSessionAttendance(...args),
  listAttendanceRecords: (...args: Parameters<TypeOrmAttendanceReader['listAttendanceRecords']>) =>
    new TypeOrmAttendanceReader(AppDataSource.manager).listAttendanceRecords(...args),
};

const classroomRouter = createClassroomRouter({
  listClasses: new ClassController('listClasses', {
    classes: classReader,
    createClass: classCommandHandlers,
    updateClass: classCommandHandlers,
    archiveClass: classCommandHandlers,
  }),
  getClassById: new ClassController('getClassById', {
    classes: classReader,
    createClass: classCommandHandlers,
    updateClass: classCommandHandlers,
    archiveClass: classCommandHandlers,
  }),
  getClassDetails: new ClassController('getClassDetails', {
    classes: classReader,
    createClass: classCommandHandlers,
    updateClass: classCommandHandlers,
    archiveClass: classCommandHandlers,
  }),
  createClass: new ClassController('createClass', {
    classes: classReader,
    createClass: classCommandHandlers,
    updateClass: classCommandHandlers,
    archiveClass: classCommandHandlers,
  }),
  updateClass: new ClassController('updateClass', {
    classes: classReader,
    createClass: classCommandHandlers,
    updateClass: classCommandHandlers,
    archiveClass: classCommandHandlers,
  }),
  archiveClass: new ClassController('archiveClass', {
    classes: classReader,
    createClass: classCommandHandlers,
    updateClass: classCommandHandlers,
    archiveClass: classCommandHandlers,
  }),
});

const classScheduleRouter = createClassScheduleRouter({
  listClassSchedules: new ClassScheduleController('listClassSchedules', {
    classSchedules: classScheduleReader,
  }),
});

const sessionRouter = createSessionRouter({
  listSessions: new SessionController('listSessions', {
    sessions: sessionReader,
    commandHandlers: sessionCommandHandlers,
  }),
  listClassSessions: new SessionController('listClassSessions', {
    sessions: sessionReader,
    commandHandlers: sessionCommandHandlers,
  }),
  createManualSession: new SessionController('createManualSession', {
    sessions: sessionReader,
    commandHandlers: sessionCommandHandlers,
  }),
  cancelSession: new SessionController('cancelSession', {
    sessions: sessionReader,
    commandHandlers: sessionCommandHandlers,
  }),
});

const attendanceRouter = createAttendanceRouter({
  getSessionAttendance: new AttendanceController('getSessionAttendance', {
    attendance: attendanceReader,
    commandHandlers: attendanceCommandHandlers,
  }),
  syncSessionAttendance: new AttendanceController('syncSessionAttendance', {
    attendance: attendanceReader,
    commandHandlers: attendanceCommandHandlers,
  }),
  upsertSessionAttendance: new AttendanceController('upsertSessionAttendance', {
    attendance: attendanceReader,
    commandHandlers: attendanceCommandHandlers,
  }),
  listAttendanceRecords: new AttendanceController('listAttendanceRecords', {
    attendance: attendanceReader,
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
