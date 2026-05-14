import type { RequestHandler } from 'express';

import { AppDataSource } from './data-source.js';
import { DbContext } from './db-context.js';

export const attachDbContext: RequestHandler = (req, _res, next) => {
  req.dbContext = new DbContext(AppDataSource);
  next();
};
