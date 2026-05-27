import { existsSync } from 'node:fs';
import { join } from 'node:path';

import express from 'express';

import config from './config.js';
import { AppDataSource } from './infrastructure/database/data-source.js';
import { errorHandler, notFoundHandler } from './infrastructure/http/error-handler.middleware.js';
import { attachRequestContext } from './infrastructure/http/request-context.js';
import { appModules } from './modules/app-modules.js';
import { configurePassport } from './infrastructure/security/configurePassport.js';

export function createApp(): express.Express {
  const app = express();
  const passport = configurePassport();

  app.use(express.json());
  app.use(attachRequestContext());
  app.use(passport.initialize());

  app.get(`${config.apiPrefix}/health`, (_req, res) => {
    res.json({ ok: true, database: AppDataSource.isInitialized });
  });

  for (const module of appModules) {
    for (const route of module.routes) {
      const mountPath = route.path === '/'
        ? config.apiPrefix
        : `${config.apiPrefix}${route.path}`;

      app.use(mountPath, route.router);
    }
  }

  if (config.frontendDistDir && existsSync(join(config.frontendDistDir, 'index.html'))) {
    const indexPath = join(config.frontendDistDir, 'index.html');

    app.use(express.static(config.frontendDistDir));
    app.use((req, res, next) => {
      if (
        req.method !== 'GET'
        || req.path === config.apiPrefix
        || req.path.startsWith(`${config.apiPrefix}/`)
      ) {
        next();
        return;
      }

      res.sendFile(indexPath);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
