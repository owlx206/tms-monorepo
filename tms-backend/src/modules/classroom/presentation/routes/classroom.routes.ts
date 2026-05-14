import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../../entities/enums.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import { authorizeOwnedClassParam, requireRoles } from '../../../identity/index.js';
import {
  classIdParamSchema,
  classListQuerySchema,
  createClassBodySchema,
  updateClassBodySchema,
} from './classroom.schema.js';
import { ClassController } from '../controllers/ClassController.js';

type ClassroomRouteControllers = {
  listClasses: ClassController;
  getClassById: ClassController;
  getClassDetails: ClassController;
  createClass: ClassController;
  updateClass: ClassController;
  archiveClass: ClassController;
};

export function createClassroomRouter(controllers: ClassroomRouteControllers): Router {
  const router = Router();

  router.use(passport.authenticate('jwt', { session: false }));
  router.use(requireRoles([TeacherRole.Teacher]));

  router.get('/classes', validate({ query: classListQuerySchema }), adaptExpressRoute(controllers.listClasses));
  router.post('/classes', validate({ body: createClassBodySchema }), adaptExpressRoute(controllers.createClass));
  router.get('/classes/:classId/details', validate({ params: classIdParamSchema }), authorizeOwnedClassParam(), adaptExpressRoute(controllers.getClassDetails));
  router.get('/classes/:classId', validate({ params: classIdParamSchema }), authorizeOwnedClassParam(), adaptExpressRoute(controllers.getClassById));
  router.patch('/classes/:classId', validate({
    body: updateClassBodySchema,
    params: classIdParamSchema,
  }), authorizeOwnedClassParam(), adaptExpressRoute(controllers.updateClass));
  router.post('/classes/:classId/archive', validate({ params: classIdParamSchema }), authorizeOwnedClassParam(), adaptExpressRoute(controllers.archiveClass));
  router.post('/classes/:classId/close', validate({ params: classIdParamSchema }), authorizeOwnedClassParam(), adaptExpressRoute(controllers.archiveClass));

  return router;
}
