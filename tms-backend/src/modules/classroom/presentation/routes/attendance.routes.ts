import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../../entities/enums.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import {
  authorizeOwnedSessionParam,
  authorizeOwnedStudentParam,
  requireRoles,
} from '../../../identity/index.js';
import {
  attendanceListQuerySchema,
  sessionIdParamSchema,
  sessionStudentIdParamSchema,
  upsertAttendanceBodySchema,
} from './attendance.schema.js';
import { AttendanceController } from '../controllers/AttendanceController.js';

type AttendanceRouteControllers = {
  getSessionAttendance: AttendanceController;
  syncSessionAttendance: AttendanceController;
  upsertSessionAttendance: AttendanceController;
  listAttendanceRecords: AttendanceController;
};

export function createAttendanceRouter(controllers: AttendanceRouteControllers): Router {
  const router = Router();

  router.use(passport.authenticate('jwt', { session: false }));
  router.use(requireRoles([TeacherRole.Teacher]));

  router.get('/sessions/:sessionId/attendance', validate({ params: sessionIdParamSchema }), authorizeOwnedSessionParam(), adaptExpressRoute(controllers.getSessionAttendance));
  router.post('/sessions/:sessionId/attendance/sync', validate({ params: sessionIdParamSchema }), authorizeOwnedSessionParam(), adaptExpressRoute(controllers.syncSessionAttendance));
  router.put('/sessions/:sessionId/attendance/:studentId', validate({
    body: upsertAttendanceBodySchema,
    params: sessionStudentIdParamSchema,
  }), authorizeOwnedSessionParam(), authorizeOwnedStudentParam(), adaptExpressRoute(controllers.upsertSessionAttendance));
  router.get('/attendance', validate({ query: attendanceListQuerySchema }), adaptExpressRoute(controllers.listAttendanceRecords));

  return router;
}
