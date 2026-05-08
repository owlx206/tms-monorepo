import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../../entities/enums.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import {
  authorizeOwnedClassBody,
  authorizeOwnedClassQuery,
  authorizeOwnedStudentBody,
  authorizeOwnedStudentParam,
  requireRoles,
} from '../../../identity/index.js';
import {
  archivePendingStudentBodySchema,
  bulkWithdrawStudentsBodySchema,
  bulkTransferStudentsBodySchema,
  createStudentBodySchema,
  withdrawStudentBodySchema,
  reinstateStudentBodySchema,
  studentIdParamSchema,
  studentListQuerySchema,
  transferStudentBodySchema,
  updateStudentBodySchema,
} from './enrollment.schema.js';
import { StudentController } from '../controllers/StudentController.js';

type StudentRouteControllers = {
  listStudents: StudentController;
  getStudentById: StudentController;
  createStudent: StudentController;
  updateStudent: StudentController;
  inviteStudentToCurrentClass: StudentController;
  transferStudent: StudentController;
  bulkTransferStudents: StudentController;
  withdrawStudent: StudentController;
  bulkWithdrawStudents: StudentController;
  reinstateStudent: StudentController;
  archivePendingStudent: StudentController;
};

export function createStudentRouter(controllers: StudentRouteControllers): Router {
  const studentRouter = Router();

  studentRouter.use(passport.authenticate('jwt', { session: false }));
  studentRouter.use(requireRoles([TeacherRole.Teacher]));

  studentRouter.get('/students', validate({ query: studentListQuerySchema }), authorizeOwnedClassQuery(), adaptExpressRoute(controllers.listStudents));

  studentRouter.post('/students', validate({ body: createStudentBodySchema }), authorizeOwnedClassBody('class_id'), adaptExpressRoute(controllers.createStudent));

  studentRouter.post('/students/bulk/transfer', validate({ body: bulkTransferStudentsBodySchema }), authorizeOwnedClassBody('to_class_id'), authorizeOwnedStudentBody('student_ids'), adaptExpressRoute(controllers.bulkTransferStudents));

  studentRouter.post('/students/bulk/withdraw', validate({ body: bulkWithdrawStudentsBodySchema }), authorizeOwnedStudentBody('student_ids'), adaptExpressRoute(controllers.bulkWithdrawStudents));

  studentRouter.get('/students/:studentId', validate({ params: studentIdParamSchema }), authorizeOwnedStudentParam(), adaptExpressRoute(controllers.getStudentById));

  studentRouter.patch('/students/:studentId', validate({
    body: updateStudentBodySchema,
    params: studentIdParamSchema,
  }), authorizeOwnedStudentParam(), adaptExpressRoute(controllers.updateStudent));

  studentRouter.post('/students/:studentId/discord/invite-current-class', validate({
    params: studentIdParamSchema,
  }), authorizeOwnedStudentParam(), adaptExpressRoute(controllers.inviteStudentToCurrentClass));

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
