import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { isDomainError } from '../errors/domain.error.js';
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

      if (response.body === undefined) {
        res.status(response.statusCode).end();
        return;
      }

      res.status(response.statusCode).json(response.body);
    } catch (error) {
      if (isDomainError(error)) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      next(error);
    }
  };
}

function buildDefaultRequest(req: Request, res: Response): HttpRequest {
  const validated = res.locals.validated as ValidatedRequestData | undefined;

  return {
    body: validated?.body ?? req.body,
    params: validated?.params ?? req.params,
    query: validated?.query ?? req.query,
    user: req.user,
    headers: req.headers,
  };
}
