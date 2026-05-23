import type { AppModule } from '../module.types.js';
import { TypeOrmDiscordCacheStore } from '../../infrastructure/external/discord/cache/discord-cache.store.js';
import { TypeOrmSysadminDiscordBotCredentialStore } from '../identity/infrastructure/persistence/typeorm/Writer.js';
import { AddGymProblemUseCase } from './application/commands/AddGymProblemUseCase.js';
import { BindClassGymUseCase } from './application/commands/BindClassGymUseCase.js';
import { UnbindClassGymUseCase } from './application/commands/UnbindClassGymUseCase.js';
import { UpsertGymStandingUseCase } from './application/commands/UpsertGymStandingUseCase.js';
import { GetGymStandingMatrixUseCase } from './application/queries/GetGymStandingMatrixUseCase.js';
import { ListGymsUseCase } from './application/queries/ListGymsUseCase.js';
import { BindClassDiscordGuildUseCase } from './application/commands/BindClassDiscordGuildUseCase.js';
import { SendChannelPostUseCase } from './application/commands/SendChannelPostUseCase.js';
import { UnbindClassDiscordGuildUseCase } from './application/commands/UnbindClassDiscordGuildUseCase.js';
import { GetDiscordBotInviteLinkUseCase } from './application/queries/GetDiscordBotInviteLinkUseCase.js';
import { ListTeacherDiscordChannelsUseCase } from './application/queries/ListTeacherDiscordChannelsUseCase.js';
import { ListTeacherDiscordGuildsUseCase } from './application/queries/ListTeacherDiscordGuildsUseCase.js';
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
const classDiscordUseCases = {
  listDiscordGuilds: new ListTeacherDiscordGuildsUseCase(),
  listDiscordGuildChannels: new ListTeacherDiscordChannelsUseCase(),
  discordCache,
  getBotInviteLink: new GetDiscordBotInviteLinkUseCase(discordBotCredentialStore),
  upsertDiscordGuildByClass: new BindClassDiscordGuildUseCase(classroomDiscordWriter),
  unbindDiscordGuildByClass: new UnbindClassDiscordGuildUseCase(classroomDiscordWriter),
  sendChannelPost: new SendChannelPostUseCase(classroomDiscordWriter, discordBotCredentialStore),
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
const classGymUseCases = {
  listAvailableClassGyms: (teacherId: number, _classId: number, filters: Parameters<ListGymsUseCase['execute']>[1]) =>
    new ListGymsUseCase(createGymReader()).execute(teacherId, filters),
  bindClassGym: (
    teacherId: number,
    classId: number,
    input: Parameters<BindClassGymUseCase['execute']>[2],
  ) => AppDataSource.transaction((manager) =>
    new BindClassGymUseCase(new TypeOrmGymWriter(manager)).execute(teacherId, classId, input)),
  unbindClassGym: (teacherId: number, classId: number, gymId: number) =>
    AppDataSource.transaction((manager) =>
      new UnbindClassGymUseCase(new TypeOrmGymWriter(manager)).execute(teacherId, classId, gymId)),
  addGymProblem: (
    teacherId: number,
    classId: number,
    gymId: number,
    input: Parameters<AddGymProblemUseCase['execute']>[3],
  ) => AppDataSource.transaction((manager) =>
    new AddGymProblemUseCase(new TypeOrmGymWriter(manager)).execute(teacherId, classId, gymId, input)),
  upsertGymStanding: (
    teacherId: number,
    classId: number,
    gymId: number,
    input: Parameters<UpsertGymStandingUseCase['execute']>[3],
  ) => AppDataSource.transaction((manager) =>
    new UpsertGymStandingUseCase(new TypeOrmGymWriter(manager)).execute(teacherId, classId, gymId, input)),
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
  listDiscordGuilds: new ClassDiscordController('listDiscordGuilds', classDiscordUseCases),
  listDiscordGuildChannels: new ClassDiscordController('listDiscordGuildChannels', classDiscordUseCases),
  completeDiscordInstall: new ClassDiscordController('completeDiscordInstall', classDiscordUseCases),
  getBotInviteLink: new ClassDiscordController('getBotInviteLink', classDiscordUseCases),
  upsertClassDiscordBinding: new ClassDiscordController('upsertClassDiscordBinding', classDiscordUseCases),
  unbindClassDiscordBinding: new ClassDiscordController('unbindClassDiscordBinding', classDiscordUseCases),
  sendChannelPost: new ClassDiscordController('sendChannelPost', classDiscordUseCases),
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
  listAvailableClassGyms: new ClassGymController('listAvailableClassGyms', classGymUseCases),
  bindClassGym: new ClassGymController('bindClassGym', classGymUseCases),
  unbindClassGym: new ClassGymController('unbindClassGym', classGymUseCases),
  addGymProblem: new ClassGymController('addGymProblem', classGymUseCases),
  upsertGymStanding: new ClassGymController('upsertGymStanding', classGymUseCases),
});

const classGymStandingReportRouter = createClassGymStandingReportRouter(
  new ClassGymStandingReportController({
    getGymStandingMatrix: (teacherId, classId, gymId) =>
      new GetGymStandingMatrixUseCase(createGymReader()).execute(teacherId, classId, gymId),
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
