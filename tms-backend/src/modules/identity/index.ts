export { configurePassport } from './infrastructure/auth/configurePassport.js';
import { TypeOrmSysadminDiscordBotCredentialStore } from './infrastructure/persistence/typeorm/TypeOrmSysadminDiscordBotCredentialStore.js';
import type { SysadminDiscordBotCredentialStore } from './infrastructure/persistence/typeorm/SysadminDiscordBotCredentialStore.js';

export type { SysadminDiscordBotCredentialStore } from './infrastructure/persistence/typeorm/SysadminDiscordBotCredentialStore.js';

export function createSysadminDiscordBotCredentialStore(): SysadminDiscordBotCredentialStore {
  return new TypeOrmSysadminDiscordBotCredentialStore();
}

export {
  authorizeOwnedClassBody,
  authorizeOwnedClassParam,
  authorizeOwnedClassQuery,
  authorizeOwnedClasses,
  authorizeOwnedFeeRecordParam,
  authorizeOwnedSessionParam,
  authorizeOwnedStudentBody,
  authorizeOwnedStudentParam,
  authorizeOwnedStudentQuery,
  authorizeOwnedTopicParam,
  authorizeOwnedTransactionParam,
} from './presentation/middlewares/ownership.js';
export { requireRoles } from './presentation/middlewares/rbac.js';
export { ensureSystemAdminAccount } from './infrastructure/bootstrap/ensureSystemAdminAccount.js';
