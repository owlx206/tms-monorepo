import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../account/contracts/types.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import { attachRequestContext } from '../../../../infrastructure/http/request-context.js';
import { authorizeOwnedSessionParam, authorizeOwnedStudentParam } from '../../../../infrastructure/security/ownership.js';
import { requireRoles } from '../../../../infrastructure/security/rbac.js';
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

  const requireTeacherAuth = [
    passport.authenticate('jwt', { session: false }),
    requireRoles([TeacherRole.Teacher]),
    attachRequestContext(),
  ];
  router.use('/sessions', ...requireTeacherAuth);
  router.use('/attendance', ...requireTeacherAuth);

  router.get('/sessions/:sessionId/attendance', validate({ params: sessionIdParamSchema }), authorizeOwnedSessionParam(), adaptExpressRoute(controllers.getSessionAttendance));
  router.post('/sessions/:sessionId/attendance/sync', validate({ params: sessionIdParamSchema }), authorizeOwnedSessionParam(), adaptExpressRoute(controllers.syncSessionAttendance));
  router.put('/sessions/:sessionId/attendance/:studentId', validate({
    body: upsertAttendanceBodySchema,
    params: sessionStudentIdParamSchema,
  }), authorizeOwnedSessionParam(), authorizeOwnedStudentParam(), adaptExpressRoute(controllers.upsertSessionAttendance));
  router.get('/attendance', validate({ query: attendanceListQuerySchema }), adaptExpressRoute(controllers.listAttendanceRecords));

  return router;
}
