import express from 'express';

import config from './config.js';
import { AppDataSource } from './infrastructure/database/data-source.js';
import { attachDbContext } from './infrastructure/database/db-context.middleware.js';
import { errorHandler, notFoundHandler } from './infrastructure/http/error-handler.middleware.js';
import { appModules } from './modules/index.js';
import { configurePassport } from './modules/identity/index.js';

export function createApp(): express.Express {
  const app = express();
  const passport = configurePassport();

  app.use(express.json());
  app.use(attachDbContext);
  app.use(passport.initialize());

  app.get(`${config.apiPrefix}/health`, (_req, res) => {
    res.json({ ok: true, database: AppDataSource.isInitialized });
  });

  for (const module of appModules) {
    for (const route of module.routes) {
      app.use(`${config.apiPrefix}${route.path === '/' ? '' : route.path}`, route.router);
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
