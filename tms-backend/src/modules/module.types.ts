import type { Router } from 'express';
import type { EntityTarget } from 'typeorm';

export interface ModuleRoute {
  path: string;
  router: Router;
}

export interface AppModule {
  name: string;
  entities: EntityTarget<unknown>[];
  routes: ModuleRoute[];
}
