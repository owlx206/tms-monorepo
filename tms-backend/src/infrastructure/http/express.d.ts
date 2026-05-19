import type { RequestContext } from './request-context.js';
import type { Teacher } from '../../modules/identity/infrastructure/persistence/typeorm/entities/teacher.entity.js';

declare global {
  namespace Express {
    interface User extends Teacher {}

    interface Request {
      context: RequestContext;
    }
  }
}

export {};
