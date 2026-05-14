import { IsNull, MoreThanOrEqual, type EntityManager } from 'typeorm';

import {
  DiscordServer,
  Enrollment,
  Session,
  Topic,
} from '../../../../../entities/index.js';
import { SessionStatus } from '../../../../../entities/enums.js';
import { ClassServiceError } from '../../../../../shared/errors/class.error.js';
import { TypeOrmFinanceFeeSync } from '../../../../finance/index.js';

const financeFeeSync = new TypeOrmFinanceFeeSync();

export async function assertClassArchivable(
  manager: EntityManager,
  teacherId: number,
  classId: number,
): Promise<void> {
  const enrollmentRepo = manager.getRepository(Enrollment);
  const topicRepo = manager.getRepository(Topic);
  const discordServerRepo = manager.getRepository(DiscordServer);

  const activeEnrollmentCount = await enrollmentRepo.count({
    where: {
      teacher_id: teacherId,
      class_id: classId,
      unenrolled_at: IsNull(),
    },
  });

  if (activeEnrollmentCount > 0) {
    throw new ClassServiceError(
      `Không thể đóng lớp: còn ${activeEnrollmentCount} học sinh đang học trong lớp`,
      409,
    );
  }

  const activeTopicCount = await topicRepo.count({
    where: {
      teacher_id: teacherId,
      class_id: classId,
      closed_at: IsNull(),
    },
  });

  if (activeTopicCount > 0) {
    throw new ClassServiceError(
      `Không thể đóng lớp: còn ${activeTopicCount} chuyên đề chưa đóng`,
      409,
    );
  }

  const linkedDiscordServerCount = await discordServerRepo.count({
    where: {
      teacher_id: teacherId,
      class_id: classId,
    },
  });

  if (linkedDiscordServerCount > 0) {
    throw new ClassServiceError(
      'Không thể đóng lớp: lớp vẫn đang liên kết với Discord server',
      409,
    );
  }
}

export async function cancelUpcomingScheduledSessionsForClass(
  manager: EntityManager,
  teacherId: number,
  classId: number,
  archivedAt: Date,
): Promise<void> {
  const sessionRepo = manager.getRepository(Session);
  const upcomingScheduledSessions = await sessionRepo.find({
    where: {
      teacher_id: teacherId,
      class_id: classId,
      status: SessionStatus.Scheduled,
      scheduled_at: MoreThanOrEqual(archivedAt),
    },
  });

  if (upcomingScheduledSessions.length === 0) {
    return;
  }

  upcomingScheduledSessions.forEach((session) => {
    session.cancel(archivedAt);
  });

  await sessionRepo.save(upcomingScheduledSessions);
  await financeFeeSync.cancelFeeRecordsForSessions(
    manager,
    teacherId,
    upcomingScheduledSessions.map((session) => session.id),
    archivedAt,
  );
}
