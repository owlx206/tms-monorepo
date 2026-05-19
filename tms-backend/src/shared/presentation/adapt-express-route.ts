import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { isHttpError } from '../errors/HttpError.js';
import type { Controller } from './Controller.js';
import type { HttpRequest } from './HttpRequest.js';

type BuildHttpRequest = (req: Request, res: Response) => HttpRequest;

type ValidatedRequestData = {
  body?: unknown;
  params?: unknown;
  query?: unknown;
};

export function adaptExpressRoute(
  controller: Controller,
  buildRequest?: BuildHttpRequest,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = buildRequest?.(req, res) ?? buildDefaultRequest(req, res);
      const response = await controller.handle(request);

      if (response.headers) {
        Object.entries(response.headers).forEach(([name, value]) => {
          res.setHeader(name, value);
        });
      }

      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers?.Location) {
        res.redirect(response.statusCode, response.headers.Location);
        return;
      }

      if (response.body === undefined) {
        res.status(response.statusCode).end();
        return;
      }

      if (typeof response.body === 'string') {
        res.status(response.statusCode).send(response.body);
        return;
      }

      res.status(response.statusCode).json(response.body);
    } catch (error) {
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      next(error);
    }
  };
}

function buildDefaultRequest(req: Request, res: Response): HttpRequest {
  const validated = res.locals.validated as ValidatedRequestData | undefined;
  const context = {
    ...(req.context ?? res.locals.context),
    ...('body' in (validated ?? {}) ? { body: validated?.body } : {}),
    ...('params' in (validated ?? {}) ? { params: validated?.params } : {}),
    ...('query' in (validated ?? {}) ? { query: validated?.query } : {}),
  };

  return {
    body: validated?.body ?? req.body,
    params: validated?.params ?? req.params,
    query: validated?.query ?? req.query,
    user: req.user,
    context,
    headers: req.headers,
  };
}
