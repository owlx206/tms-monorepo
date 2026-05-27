import { classroomModule } from './classroom/classroom.module.js';
import { financeModule } from './finance/finance.module.js';
import { accountModule } from './account/account.module.js';
import { studentModule } from './student/student.module.js';
import { systemModule } from './system/system.module.js';
import type { AppModule } from './module.types.js';

export const appModules: AppModule[] = [
  accountModule,
  studentModule,
  systemModule,
  classroomModule,
  financeModule,
];
