import { Router } from 'express';
import passport from 'passport';

import type { AppModule } from '../module.types.js';
import { TeacherRole } from '../account/contracts/types.js';
import { TypeOrmDiscordCacheStore } from '../../infrastructure/external/discord/cache/discord-cache.store.js';
import { TypeOrmDiscordBotCredentialStore } from '../account/infrastructure/persistence/typeorm/Writer.js';
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
import {
  attendanceListQuerySchema,
  sessionIdParamSchema as attendanceSessionIdParamSchema,
  sessionStudentIdParamSchema,
  upsertAttendanceBodySchema,
} from './presentation/routes/attendance.schema.js';
import {
  channelPostBodySchema,
  classIdParamSchema,
  classListQuerySchema,
  createClassBodySchema,
  createManualSessionBodySchema,
  guildIdParamSchema,
  sessionIdParamSchema,
  sessionListQuerySchema,
  updateClassBodySchema,
  upsertDiscordGuildBodySchema,
} from './presentation/routes/classroom.schema.js';
import {
  bindClassGymBodySchema,
  classGymParamSchema,
  gymListQuerySchema,
} from './presentation/routes/gym/class-gym.schema.js';
import { AppDataSource } from '../../infrastructure/database/data-source.js';
import { attachRequestContext } from '../../infrastructure/http/request-context.js';
import { authorizeOwnedClassParam, authorizeOwnedClassQuery, authorizeOwnedGymParam, authorizeOwnedSessionParam, authorizeOwnedStudentParam } from '../../infrastructure/security/ownership.js';
import { requireRoles } from '../../infrastructure/security/rbac.js';
import { adaptExpressRoute } from '../../shared/presentation/adapt-express-route.js';
import { validate } from '../../shared/middlewares/validate.js';

const classCommandHandlers = new TypeOrmClassCommandHandlers();
const sessionCommandHandlers = new TypeOrmSessionCommandHandlers();
const attendanceCommandHandlers = new TypeOrmAttendanceCommandHandlers();
const createGymReader = () => new TypeOrmGymReader(AppDataSource.manager);
const discordBotCredentialStore = new TypeOrmDiscordBotCredentialStore();
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

const classroomRouteControllers = {
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
};
const classRouter = Router();
classRouter.use(
  passport.authenticate('jwt', { session: false }),
  requireRoles([TeacherRole.Teacher]),
  attachRequestContext(),
);
classRouter.get('/', validate({ query: classListQuerySchema }), adaptExpressRoute(classroomRouteControllers.listClasses));
classRouter.post('/', validate({ body: createClassBodySchema }), adaptExpressRoute(classroomRouteControllers.createClass));
classRouter.get('/:classId/details', validate({ params: classIdParamSchema }), authorizeOwnedClassParam(), adaptExpressRoute(classroomRouteControllers.getClassDetails));
classRouter.get('/:classId', validate({ params: classIdParamSchema }), authorizeOwnedClassParam(), adaptExpressRoute(classroomRouteControllers.getClassById));
classRouter.patch('/:classId', validate({
  body: updateClassBodySchema,
  params: classIdParamSchema,
}), authorizeOwnedClassParam(), adaptExpressRoute(classroomRouteControllers.updateClass));
classRouter.put(
  '/:classId/discord-guild/select',
  validate({ params: classIdParamSchema, body: upsertDiscordGuildBodySchema }),
  authorizeOwnedClassParam(),
  adaptExpressRoute(classroomRouteControllers.upsertClassDiscordBinding),
);
classRouter.delete(
  '/:classId/discord-guild',
  validate({ params: classIdParamSchema }),
  authorizeOwnedClassParam(),
  adaptExpressRoute(classroomRouteControllers.unbindClassDiscordBinding),
);
classRouter.post('/:classId/archive', validate({ params: classIdParamSchema }), authorizeOwnedClassParam(), adaptExpressRoute(classroomRouteControllers.archiveClass));
classRouter.post('/:classId/close', validate({ params: classIdParamSchema }), authorizeOwnedClassParam(), adaptExpressRoute(classroomRouteControllers.archiveClass));

const classroomDiscordRouter = Router();
classroomDiscordRouter.get('/oauth/callback', adaptExpressRoute(classroomRouteControllers.completeDiscordInstall));
classroomDiscordRouter.use(
  passport.authenticate('jwt', { session: false }),
  requireRoles([TeacherRole.Teacher]),
  attachRequestContext(),
);
classroomDiscordRouter.get('/bot-invite-link', adaptExpressRoute(classroomRouteControllers.getBotInviteLink));
classroomDiscordRouter.get('/guilds', adaptExpressRoute(classroomRouteControllers.listDiscordGuilds));
classroomDiscordRouter.get(
  '/guilds/:guildId/channels',
  validate({ params: guildIdParamSchema }),
  adaptExpressRoute(classroomRouteControllers.listDiscordGuildChannels),
);
classroomDiscordRouter.post(
  '/messages/channel-post',
  validate({ body: channelPostBodySchema }),
  adaptExpressRoute(classroomRouteControllers.sendChannelPost),
);

const listClassSchedulesController = new ClassScheduleController('listClassSchedules', {
  classSchedules: classScheduleReader,
});
const classScheduleRouter = Router();
classScheduleRouter.use(
  passport.authenticate('jwt', { session: false }),
  requireRoles([TeacherRole.Teacher]),
  attachRequestContext(),
);
classScheduleRouter.get('/:classId/schedules', validate({ params: classIdParamSchema }), authorizeOwnedClassParam(), adaptExpressRoute(listClassSchedulesController));

const sessionRouteControllers = {
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
};
const sessionRouter = Router();
sessionRouter.use(
  passport.authenticate('jwt', { session: false }),
  requireRoles([TeacherRole.Teacher]),
  attachRequestContext(),
);
sessionRouter.get('/', validate({ query: sessionListQuerySchema }), authorizeOwnedClassQuery(), adaptExpressRoute(sessionRouteControllers.listSessions));
sessionRouter.post('/:sessionId/cancel', validate({ params: sessionIdParamSchema }), authorizeOwnedSessionParam(), adaptExpressRoute(sessionRouteControllers.cancelSession));

const classSessionRouter = Router();
classSessionRouter.use(
  passport.authenticate('jwt', { session: false }),
  requireRoles([TeacherRole.Teacher]),
  attachRequestContext(),
);
classSessionRouter.get('/:classId/sessions', validate({
  params: classIdParamSchema,
  query: sessionListQuerySchema,
}), authorizeOwnedClassParam(), adaptExpressRoute(sessionRouteControllers.listClassSessions));
classSessionRouter.post('/:classId/sessions/manual', validate({
  body: createManualSessionBodySchema,
  params: classIdParamSchema,
}), authorizeOwnedClassParam(), adaptExpressRoute(sessionRouteControllers.createManualSession));

const attendanceRouteControllers = {
  getSessionAttendance: new AttendanceController('getSessionAttendance', {
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
};
const attendanceRouter = Router();
attendanceRouter.use(
  passport.authenticate('jwt', { session: false }),
  requireRoles([TeacherRole.Teacher]),
  attachRequestContext(),
);
attendanceRouter.get('/', validate({ query: attendanceListQuerySchema }), adaptExpressRoute(attendanceRouteControllers.listAttendanceRecords));

const sessionAttendanceRouter = Router();
sessionAttendanceRouter.use(
  passport.authenticate('jwt', { session: false }),
  requireRoles([TeacherRole.Teacher]),
  attachRequestContext(),
);
sessionAttendanceRouter.get('/:sessionId/attendance', validate({ params: attendanceSessionIdParamSchema }), authorizeOwnedSessionParam(), adaptExpressRoute(attendanceRouteControllers.getSessionAttendance));
sessionAttendanceRouter.put('/:sessionId/attendance/:studentId', validate({
  body: upsertAttendanceBodySchema,
  params: sessionStudentIdParamSchema,
}), authorizeOwnedSessionParam(), authorizeOwnedStudentParam(), adaptExpressRoute(attendanceRouteControllers.upsertSessionAttendance));

const listAvailableClassGymsController = new ClassGymController('listAvailableClassGyms', classGymActions);
const bindClassGymController = new ClassGymController('bindClassGym', classGymActions);
const unbindClassGymController = new ClassGymController('unbindClassGym', classGymActions);
const classGymStandingReportController = new ClassGymStandingReportController({
  getGymStandingMatrix: (teacherId, classId, gymId) =>
    new GetGymStanding(createGymReader()).execute(teacherId, classId, gymId),
});
const classGymRouter = Router();
classGymRouter.use(
  passport.authenticate('jwt', { session: false }),
  requireRoles([TeacherRole.Teacher]),
  attachRequestContext(),
);
classGymRouter.get(
  '/:classId/available-gyms',
  validate({ params: classIdParamSchema, query: gymListQuerySchema }),
  authorizeOwnedClassParam(),
  adaptExpressRoute(listAvailableClassGymsController),
);
classGymRouter.post(
  '/:classId/gyms',
  validate({ params: classIdParamSchema, body: bindClassGymBodySchema }),
  authorizeOwnedClassParam(),
  adaptExpressRoute(bindClassGymController),
);
classGymRouter.delete(
  '/:classId/gyms/:gymId',
  validate({ params: classGymParamSchema }),
  authorizeOwnedClassParam(),
  authorizeOwnedGymParam(),
  adaptExpressRoute(unbindClassGymController),
);

const classGymStandingReportRouter = Router();
classGymStandingReportRouter.use(
  passport.authenticate('jwt', { session: false }),
  requireRoles([TeacherRole.Teacher]),
  attachRequestContext(),
);
classGymStandingReportRouter.get(
  '/:classId/gyms/:gymId/standing',
  validate({ params: classGymParamSchema }),
  authorizeOwnedClassParam(),
  authorizeOwnedGymParam(),
  adaptExpressRoute(classGymStandingReportController),
);

export const classroomModule: AppModule = {
  name: 'classroom',
  entities: [Class, ClassSchedule, Session, Attendance, ClassDiscordBinding, Gym, GymProblem, GymStanding],
  routes: [
    { path: '/classes', router: classRouter },
    { path: '/classes', router: classGymRouter },
    { path: '/classes', router: classGymStandingReportRouter },
    { path: '/classes', router: classScheduleRouter },
    { path: '/classes', router: classSessionRouter },
    { path: '/discord', router: classroomDiscordRouter },
    { path: '/sessions', router: sessionRouter },
    { path: '/sessions', router: sessionAttendanceRouter },
    { path: '/attendance', router: attendanceRouter },
  ],
};
