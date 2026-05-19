import { classroomModule } from './classroom/classroom.module.js';
import { financeModule } from './finance/finance.module.js';
import { identityModule } from './identity/identity.module.js';
import { messagingModule } from './messaging/messaging.module.js';
import { enrollmentModule } from './enrollment/enrollment.module.js';
import { topicModule } from './topic/topic.module.js';
import type { AppModule } from './module.types.js';

export const appModules: AppModule[] = [
  identityModule,
  messagingModule,
  classroomModule,
  enrollmentModule,
  financeModule,
  topicModule,
];
