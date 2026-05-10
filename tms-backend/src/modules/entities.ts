import { AttendanceOrmEntity as Attendance } from './classroom/infrastructure/persistence/typeorm/AttendanceOrmEntity.js';
import { ClassScheduleOrmEntity as ClassSchedule } from './classroom/infrastructure/persistence/typeorm/ClassScheduleOrmEntity.js';
import { ClassOrmEntity as Class } from './classroom/infrastructure/persistence/typeorm/ClassOrmEntity.js';
import { SessionOrmEntity as Session } from './classroom/infrastructure/persistence/typeorm/SessionOrmEntity.js';
import { Enrollment } from './enrollment/infrastructure/persistence/typeorm/EnrollmentOrmEntity.js';
import { Student } from './enrollment/infrastructure/persistence/typeorm/StudentOrmEntity.js';
import { FeeRecordOrmEntity as FeeRecord } from './finance/infrastructure/persistence/typeorm/FeeRecordOrmEntity.js';
import { TransactionAuditLogOrmEntity as TransactionAuditLog } from './finance/infrastructure/persistence/typeorm/TransactionAuditLogOrmEntity.js';
import { TransactionOrmEntity as Transaction } from './finance/infrastructure/persistence/typeorm/TransactionOrmEntity.js';
import { TeacherOrmEntity as Teacher } from './identity/infrastructure/persistence/typeorm/TeacherOrmEntity.js';
import { SysadminDiscordBotCredentialOrmEntity as SysadminDiscordBotCredential } from './identity/infrastructure/persistence/typeorm/SysadminDiscordBotCredentialOrmEntity.js';
import { DiscordMessageRecipientOrmEntity as DiscordMessageRecipient } from './messaging/infrastructure/persistence/typeorm/DiscordMessageRecipientOrmEntity.js';
import { DiscordMessageOrmEntity as DiscordMessage } from './messaging/infrastructure/persistence/typeorm/DiscordMessageOrmEntity.js';
import { DiscordServerOrmEntity as DiscordServer } from './messaging/infrastructure/persistence/typeorm/DiscordServerOrmEntity.js';
import { TeacherDiscordChannelCacheOrmEntity as TeacherDiscordChannelCache } from './messaging/infrastructure/persistence/typeorm/TeacherDiscordChannelCacheOrmEntity.js';
import { TeacherDiscordServerCacheOrmEntity as TeacherDiscordServerCache } from './messaging/infrastructure/persistence/typeorm/TeacherDiscordServerCacheOrmEntity.js';
import { TopicProblemOrmEntity as TopicProblem } from './topic/infrastructure/persistence/typeorm/TopicProblemOrmEntity.js';
import { TopicStandingOrmEntity as TopicStanding } from './topic/infrastructure/persistence/typeorm/TopicStandingOrmEntity.js';
import { TopicOrmEntity as Topic } from './topic/infrastructure/persistence/typeorm/TopicOrmEntity.js';

export const appEntities = [
  Teacher,
  SysadminDiscordBotCredential,
  Student,
  Class,
  ClassSchedule,
  Session,
  Enrollment,
  Attendance,
  FeeRecord,
  Transaction,
  DiscordServer,
  TeacherDiscordServerCache,
  TeacherDiscordChannelCache,
  DiscordMessage,
  DiscordMessageRecipient,
  Topic,
  TopicProblem,
  TopicStanding,
  TransactionAuditLog,
];
