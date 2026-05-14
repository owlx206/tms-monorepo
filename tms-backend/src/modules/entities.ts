import { Attendance } from '../entities/attendance.entity.js';
import { ClassSchedule } from '../entities/class-schedule.entity.js';
import { Class } from '../entities/class.entity.js';
import { Session } from '../entities/session.entity.js';
import { Enrollment } from '../entities/enrollment.entity.js';
import { Student } from '../entities/student.entity.js';
import { FeeRecord } from '../entities/fee-record.entity.js';
import { TransactionAuditLog } from '../entities/transaction-audit-log.entity.js';
import { Transaction } from '../entities/transaction.entity.js';
import { Teacher } from '../entities/teacher.entity.js';
import { SysadminDiscordBotCredential } from '../entities/sysadmin-discord-bot-credential.entity.js';
import { DiscordServer } from '../entities/discord-server.entity.js';
import { TeacherDiscordChannelCache } from '../entities/teacher-discord-channel-cache.entity.js';
import { TeacherDiscordServerCache } from '../entities/teacher-discord-server-cache.entity.js';
import { TopicProblem } from '../entities/topic-problem.entity.js';
import { TopicStanding } from '../entities/topic-standing.entity.js';
import { Topic } from '../entities/topic.entity.js';

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
  Topic,
  TopicProblem,
  TopicStanding,
  TransactionAuditLog,
];
