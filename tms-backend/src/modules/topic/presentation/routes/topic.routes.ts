import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../identity/contracts/types.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import { attachRequestContext } from '../../../../infrastructure/http/request-context.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import { authorizeOwnedClassBody, authorizeOwnedClassQuery, authorizeOwnedStudentBody, authorizeOwnedTopicParam } from '../../../identity/presentation/middlewares/ownership.js';
import { requireRoles } from '../../../identity/presentation/middlewares/rbac.js';
import { TopicController } from '../controllers/TopicController.js';
import {
  addTopicProblemBodySchema,
  createTopicBodySchema,
  topicIdParamSchema,
  topicListQuerySchema,
  upsertTopicStandingBodySchema,
} from './topic.schema.js';

type TopicRouteControllers = {
  listTopics: TopicController;
  createTopic: TopicController;
  closeTopic: TopicController;
  addTopicProblem: TopicController;
  upsertTopicStanding: TopicController;
};

export function createTopicRouter(controllers: TopicRouteControllers): Router {
  const router = Router();

  router.use(passport.authenticate('jwt', { session: false }));
  router.use(requireRoles([TeacherRole.Teacher]));
  router.use(attachRequestContext());

  router.get(
    '/topics',
    validate({ query: topicListQuerySchema }),
    authorizeOwnedClassQuery(),
    adaptExpressRoute(controllers.listTopics),
  );
  router.post(
    '/topics',
    validate({ body: createTopicBodySchema }),
    authorizeOwnedClassBody('class_id'),
    adaptExpressRoute(controllers.createTopic),
  );
  router.post(
    '/topics/:topicId/close',
    validate({ params: topicIdParamSchema }),
    authorizeOwnedTopicParam(),
    adaptExpressRoute(controllers.closeTopic),
  );
  router.post(
    '/topics/:topicId/problems',
    validate({ params: topicIdParamSchema, body: addTopicProblemBodySchema }),
    authorizeOwnedTopicParam(),
    adaptExpressRoute(controllers.addTopicProblem),
  );
  router.put(
    '/topics/:topicId/standings',
    validate({ params: topicIdParamSchema, body: upsertTopicStandingBodySchema }),
    authorizeOwnedTopicParam(),
    authorizeOwnedStudentBody('student_id'),
    adaptExpressRoute(controllers.upsertTopicStanding),
  );

  return router;
}
