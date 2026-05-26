import type { AppModule } from '../module.types.js';
import { TypeOrmDiscordCacheStore } from '../../infrastructure/external/discord/cache/discord-cache.store.js';
import { TypeOrmSysadminDiscordBotCredentialStore } from '../account/infrastructure/persistence/typeorm/Writer.js';
import { AssignGym } from './application/commands/AssignGym.js';
import { UnassignGym } from './application/commands/UnassignGym.js';
import { GetGymStanding } from './application/queries/GetGymStanding.js';
import { ListAvailableGyms } from './application/queries/ListAvailableGyms.js';
import { AssignDiscordGuild } from './application/commands/AssignDiscordGuild.js';
import { SendChannelPost } from './application/commands/SendChannelPost.js';
import { UnassignDiscordGuild } from './application/commands/UnassignDiscordGuild.js';
import { GetDiscordBotInviteLink } from './application/queries/GetDiscordBotInviteLink.js';
import { ListDiscordChannels } from './application/queries/ListDiscordChannels.js';
import { ListDiscordGuilds } from './application/queries/ListDiscordGuilds.js';
import { Attendance } from '../../infrastructure/database/entities/attendance.entity.js';
import { ClassSchedule } from '../../infrastructure/database/entities/class-schedule.entity.js';
import { Class } from '../../infrastructure/database/entities/class.entity.js';
import { ClassDiscordBinding } from '../../infrastructure/database/entities/discord/class-discord-binding.entity.js';
import { Gym } from '../../infrastructure/database/entities/gym/gym.entity.js';
import { GymProblem } from '../../infrastructure/database/entities/gym/gym-problem.entity.js';
import { GymStanding } from '../../infrastructure/database/entities/gym/gym-standing.entity.js';
import { TypeOrmGymReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmGymWriter } from './infrastructure/persistence/typeorm/Writer.js';
import { TypeOrmClassCommandHandlers } from './infrastructure/persistence/typeorm/Writer.js';
import { TypeOrmAttendanceCommandHandlers } from './infrastructure/persistence/typeorm/Writer.js';
import { TypeOrmAttendanceReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmClassReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmClassScheduleReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmSessionCommandHandlers } from './infrastructure/persistence/typeorm/Writer.js';
import { TypeOrmSessionReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmClassroomDiscordWriter } from './infrastructure/persistence/typeorm/Writer.js';
import { Session } from '../../infrastructure/database/entities/session.entity.js';
import { ClassController } from './presentation/controllers/ClassController.js';
import { ClassDiscordController } from './presentation/controllers/ClassDiscordController.js';
import { ClassGymController } from './presentation/controllers/gym/ClassGymController.js';
import { ClassGymStandingReportController } from './presentation/controllers/gym/ClassGymStandingReportController.js';
import { AttendanceController } from './presentation/controllers/AttendanceController.js';
import { ClassScheduleController } from './presentation/controllers/ClassScheduleController.js';
import { SessionController } from './presentation/controllers/SessionController.js';
import { createAttendanceRouter } from './presentation/routes/attendance.routes.js';
import { createClassScheduleRouter } from './presentation/routes/class-schedule.routes.js';
import { createClassroomRouter } from './presentation/routes/classroom.routes.js';
import { createClassGymRouter } from './presentation/routes/gym/class-gym.routes.js';
import { createClassGymStandingReportRouter } from './presentation/routes/gym/class-gym-standing-report.routes.js';
import { createSessionRouter } from './presentation/routes/session.routes.js';
import { AppDataSource } from '../../infrastructure/database/data-source.js';

const classCommandHandlers = new TypeOrmClassCommandHandlers();
const sessionCommandHandlers = new TypeOrmSessionCommandHandlers();
const attendanceCommandHandlers = new TypeOrmAttendanceCommandHandlers();
const createGymReader = () => new TypeOrmGymReader(AppDataSource.manager);
const discordBotCredentialStore = new TypeOrmSysadminDiscordBotCredentialStore();
const discordCache = new TypeOrmDiscordCacheStore();
const classroomDiscordWriter = new TypeOrmClassroomDiscordWriter();
const classDiscordActions = {
  listDiscordGuilds: new ListDiscordGuilds(),
  listDiscordGuildChannels: new ListDiscordChannels(),
  discordCache,
  getBotInviteLink: new GetDiscordBotInviteLink(discordBotCredentialStore),
  upsertDiscordGuildByClass: new AssignDiscordGuild(classroomDiscordWriter),
  unbindDiscordGuildByClass: new UnassignDiscordGuild(classroomDiscordWriter),
  sendChannelPost: new SendChannelPost(classroomDiscordWriter, discordBotCredentialStore),
};
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
const classGymActions = {
  listAvailableClassGyms: (teacherId: number, _classId: number, filters: Parameters<ListAvailableGyms['execute']>[1]) =>
    new ListAvailableGyms(createGymReader()).execute(teacherId, filters),
  bindClassGym: (
    teacherId: number,
    classId: number,
    input: Parameters<AssignGym['execute']>[2],
  ) => AppDataSource.transaction((manager) =>
    new AssignGym(new TypeOrmGymWriter(manager)).execute(teacherId, classId, input)),
  unbindClassGym: (teacherId: number, classId: number, gymId: number) =>
    AppDataSource.transaction((manager) =>
      new UnassignGym(new TypeOrmGymWriter(manager)).execute(teacherId, classId, gymId)),
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
  listDiscordGuilds: new ClassDiscordController('listDiscordGuilds', classDiscordActions),
  listDiscordGuildChannels: new ClassDiscordController('listDiscordGuildChannels', classDiscordActions),
  completeDiscordInstall: new ClassDiscordController('completeDiscordInstall', classDiscordActions),
  getBotInviteLink: new ClassDiscordController('getBotInviteLink', classDiscordActions),
  upsertClassDiscordBinding: new ClassDiscordController('upsertClassDiscordBinding', classDiscordActions),
  unbindClassDiscordBinding: new ClassDiscordController('unbindClassDiscordBinding', classDiscordActions),
  sendChannelPost: new ClassDiscordController('sendChannelPost', classDiscordActions),
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

const classGymRouter = createClassGymRouter({
  listAvailableClassGyms: new ClassGymController('listAvailableClassGyms', classGymActions),
  bindClassGym: new ClassGymController('bindClassGym', classGymActions),
  unbindClassGym: new ClassGymController('unbindClassGym', classGymActions),
});

const classGymStandingReportRouter = createClassGymStandingReportRouter(
  new ClassGymStandingReportController({
    getGymStandingMatrix: (teacherId, classId, gymId) =>
      new GetGymStanding(createGymReader()).execute(teacherId, classId, gymId),
  }),
);

export const classroomModule: AppModule = {
  name: 'classroom',
  entities: [Class, ClassSchedule, Session, Attendance, ClassDiscordBinding, Gym, GymProblem, GymStanding],
  routes: [
    { path: '/', router: classroomRouter },
    { path: '/', router: classGymRouter },
    { path: '/', router: classGymStandingReportRouter },
    { path: '/', router: classScheduleRouter },
    { path: '/', router: sessionRouter },
    { path: '/', router: attendanceRouter },
  ],
};
