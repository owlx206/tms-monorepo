import type { RequestHandler } from 'express';
import { z, type ZodType } from 'zod';

import { HttpError } from '../errors/HttpError.js';

type RequestValidationSchemas = {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
};

type ValidatedRequestData = {
  body?: unknown;
  params?: unknown;
  query?: unknown;
};

function formatZodError(error: z.ZodError): string {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return 'invalid request';
  }

  const path = firstIssue.path.length > 0 ? `${firstIssue.path.join('.')}: ` : '';
  return `${path}${firstIssue.message}`;
}

export function validate(schemas: RequestValidationSchemas): RequestHandler {
  return (req, res, next) => {
    try {
      const validated: ValidatedRequestData = {};

      if (schemas.body) {
        validated.body = schemas.body.parse(req.body);
      }

      if (schemas.params) {
        validated.params = schemas.params.parse(req.params);
      }

      if (schemas.query) {
        validated.query = schemas.query.parse(req.query);
      }

      res.locals.validated = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new HttpError(formatZodError(error), 400));
        return;
      }

      next(error);
    }
  };
}

export function getValidatedBody<T>(res: { locals: Record<string, unknown> }): T {
  return (res.locals.validated as ValidatedRequestData).body as T;
}

export function getValidatedParams<T>(res: { locals: Record<string, unknown> }): T {
  return (res.locals.validated as ValidatedRequestData).params as T;
}

export function getValidatedQuery<T>(res: { locals: Record<string, unknown> }): T {
  return (res.locals.validated as ValidatedRequestData).query as T;
}
