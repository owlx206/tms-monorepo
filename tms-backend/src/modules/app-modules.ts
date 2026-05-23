import { classroomModule } from './classroom/classroom.module.js';
import { financeModule } from './finance/finance.module.js';
import { identityModule } from './identity/identity.module.js';
import { studentModule } from './student/student.module.js';
import type { AppModule } from './module.types.js';

export const appModules: AppModule[] = [
  identityModule,
  classroomModule,
  studentModule,
  financeModule,
];
