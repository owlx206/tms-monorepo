import type { RequestContext } from './request-context.js';
import type { Teacher } from '../database/entities/teacher.entity.js';

declare global {
  namespace Express {
    interface User extends Teacher {}

    interface Request {
      context: RequestContext;
    }
  }
}

export {};
