import { Attendance } from '../entities/attendance.entity.js';
import { ClassSchedule } from '../entities/class-schedule.entity.js';
import { Class } from '../entities/class.entity.js';
import { Session } from '../entities/session.entity.js';
import { Enrollment } from '../entities/enrollment.entity.js';
import { Student } from '../entities/student.entity.js';
import { FeeRecord } from '../entities/tuition-fee.entity.js';
import { TransactionAuditLog } from '../entities/transaction-audit-log.entity.js';
import { Transaction } from '../entities/transaction.entity.js';
import { Teacher } from '../entities/teacher.entity.js';
import { SysadminDiscordBotCredential } from '../entities/discord-bot-credential.entity.js';
import { TopicBotConfig } from '../entities/topic-bot-config.entity.js';
import { ClassDiscordBinding } from '../entities/class-guild.entity.js';
import { DiscordGuildChannelCache } from '../entities/discord-channel.entity.js';
import { DiscordUserGuild } from '../entities/discord-guild.entity.js';
import { TopicProblem } from '../entities/topic-problem.entity.js';
import { TopicStanding } from '../entities/topic-standing.entity.js';
import { Topic } from '../entities/topic.entity.js';

export const appEntities = [
  Teacher,
  SysadminDiscordBotCredential,
  TopicBotConfig,
  Student,
  Class,
  ClassSchedule,
  Session,
  Enrollment,
  Attendance,
  FeeRecord,
  Transaction,
  ClassDiscordBinding,
  DiscordUserGuild,
  DiscordGuildChannelCache,
  Topic,
  TopicProblem,
  TopicStanding,
  TransactionAuditLog,
];
