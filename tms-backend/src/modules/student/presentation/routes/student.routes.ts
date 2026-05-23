import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../identity/contracts/types.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import { attachRequestContext } from '../../../../infrastructure/http/request-context.js';
import { authorizeOwnedClassBody, authorizeOwnedClassQuery, authorizeOwnedStudentBody, authorizeOwnedStudentParam } from '../../../identity/presentation/middlewares/ownership.js';
import { requireRoles } from '../../../identity/presentation/middlewares/rbac.js';
import {
  archivePendingStudentBodySchema,
  createStudentBodySchema,
  singleStudentMessageBodySchema,
  withdrawStudentBodySchema,
  reinstateStudentBodySchema,
  studentMessageBodySchema,
  studentIdParamSchema,
  studentListQuerySchema,
  transferStudentBodySchema,
  updateStudentBodySchema,
} from './student.schema.js';
import { StudentController } from '../controllers/StudentController.js';

type StudentRouteControllers = {
  listStudents: StudentController;
  getStudentById: StudentController;
  createStudent: StudentController;
  updateStudent: StudentController;
  listStudentEnrollments: StudentController;
  getStudentDiscordAuthorizationUrl: StudentController;
  inviteStudentToCurrentClass: StudentController;
  sendStudentMessage: StudentController;
  sendStudentMessages: StudentController;
  transferStudent: StudentController;
  withdrawStudent: StudentController;
  reinstateStudent: StudentController;
  archivePendingStudent: StudentController;
};

export function createStudentRouter(controllers: StudentRouteControllers): Router {
  const studentRouter = Router();

  studentRouter.use(passport.authenticate('jwt', { session: false }));
  studentRouter.use(requireRoles([TeacherRole.Teacher]));
  studentRouter.use(attachRequestContext());

  studentRouter.get('/students', validate({ query: studentListQuerySchema }), authorizeOwnedClassQuery(), adaptExpressRoute(controllers.listStudents));

  studentRouter.post('/students', validate({ body: createStudentBodySchema }), authorizeOwnedClassBody('class_id'), adaptExpressRoute(controllers.createStudent));

  studentRouter.get('/students/:studentId', validate({ params: studentIdParamSchema }), authorizeOwnedStudentParam(), adaptExpressRoute(controllers.getStudentById));

  studentRouter.patch('/students/:studentId', validate({
    body: updateStudentBodySchema,
    params: studentIdParamSchema,
  }), authorizeOwnedStudentParam(), adaptExpressRoute(controllers.updateStudent));

  studentRouter.get('/students/:studentId/enrollments', validate({
    params: studentIdParamSchema,
  }), authorizeOwnedStudentParam(), adaptExpressRoute(controllers.listStudentEnrollments));

  studentRouter.get('/students/:studentId/discord/authorization-url', validate({
    params: studentIdParamSchema,
  }), authorizeOwnedStudentParam(), adaptExpressRoute(controllers.getStudentDiscordAuthorizationUrl));

  studentRouter.post('/students/:studentId/discord/invite-current-class', validate({
    params: studentIdParamSchema,
  }), authorizeOwnedStudentParam(), adaptExpressRoute(controllers.inviteStudentToCurrentClass));

  studentRouter.post('/students/:studentId/discord/message', validate({
    body: singleStudentMessageBodySchema,
    params: studentIdParamSchema,
  }), authorizeOwnedStudentParam(), adaptExpressRoute(controllers.sendStudentMessage));

  studentRouter.post('/students/discord/messages', validate({
    body: studentMessageBodySchema,
  }), authorizeOwnedClassBody('class_id'), authorizeOwnedStudentBody('student_ids'), adaptExpressRoute(controllers.sendStudentMessages));

  studentRouter.post('/students/:studentId/transfer', validate({
    body: transferStudentBodySchema,
    params: studentIdParamSchema,
  }), authorizeOwnedStudentParam(), authorizeOwnedClassBody('to_class_id'), adaptExpressRoute(controllers.transferStudent));

  studentRouter.post('/students/:studentId/withdraw', validate({
    body: withdrawStudentBodySchema,
    params: studentIdParamSchema,
  }), authorizeOwnedStudentParam(), adaptExpressRoute(controllers.withdrawStudent));

  studentRouter.post('/students/:studentId/reinstate', validate({
    body: reinstateStudentBodySchema,
    params: studentIdParamSchema,
  }), authorizeOwnedStudentParam(), authorizeOwnedClassBody('class_id'), adaptExpressRoute(controllers.reinstateStudent));

  studentRouter.post('/students/:studentId/archive', validate({
    body: archivePendingStudentBodySchema,
    params: studentIdParamSchema,
  }), authorizeOwnedStudentParam(), adaptExpressRoute(controllers.archivePendingStudent));

  return studentRouter;
}
