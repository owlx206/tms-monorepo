import type { ErrorRequestHandler, RequestHandler } from 'express';

import { isHttpError } from '../../shared/errors/HttpError.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (isHttpError(error)) {
    res.status(error.statusCode).json({ error: error.message, code: error.code });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'internal server error' });
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).send('Not found');
};

