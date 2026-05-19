import { Router } from 'express';
import passport from 'passport';

import { TeacherRole } from '../../../identity/contracts/types.js';
import { validate } from '../../../../shared/middlewares/validate.js';
import { attachRequestContext } from '../../../../infrastructure/http/request-context.js';
import { adaptExpressRoute } from '../../../../shared/presentation/adapt-express-route.js';
import { authorizeOwnedTopicParam } from '../../../identity/presentation/middlewares/ownership.js';
import { requireRoles } from '../../../identity/presentation/middlewares/rbac.js';
import { TopicStandingReportController } from '../controllers/TopicStandingReportController.js';
import { topicIdParamSchema } from './topic.schema.js';

export function createTopicStandingReportRouter(controller: TopicStandingReportController): Router {
  const router = Router();

  router.use(passport.authenticate('jwt', { session: false }));
  router.use(requireRoles([TeacherRole.Teacher]));
  router.use(attachRequestContext());

  router.get(
    '/topics/:topicId/standing',
    validate({ params: topicIdParamSchema }),
    authorizeOwnedTopicParam(),
    adaptExpressRoute(controller),
  );

  return router;
}
