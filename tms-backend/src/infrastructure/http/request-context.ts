import type { RequestHandler } from 'express';

import { AppDataSource } from '../database/data-source.js';
import { DbContext } from '../database/db-context.js';
import type { Teacher } from '../../modules/identity/infrastructure/persistence/typeorm/entities/teacher.entity.js';

export type RequestContext<
  TBody = unknown,
  TParams = unknown,
  TQuery = unknown,
> = {
  db: DbContext;
  teacher?: Teacher;
  teacherId?: number;
  body?: TBody;
  params: TParams;
  query?: TQuery;
};

export type ParsedRequestContext<TBody = unknown, TParams = unknown, TQuery = unknown> =
  RequestContext<TBody, TParams, TQuery>;

export function attachRequestContext(): RequestHandler {
  return (req, res, next) => {
    const teacher = req.user as Teacher | undefined;
    const currentContext = req.context as Partial<RequestContext> | undefined;
    const context = {
      ...currentContext,
      db: currentContext?.db ?? new DbContext(AppDataSource),
      ...(teacher ? { teacher, teacherId: teacher.id } : {}),
    } as RequestContext;

    req.context = context;
    res.locals.context = context;
    next();
  };
}
