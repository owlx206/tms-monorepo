import type { EntityManager } from 'typeorm';

import type {
  SessionListFilters,
  SessionSummary,
} from '../../../application/dto/ClassDto.js';
import { Session } from '../../../../../entities/session.entity.js';

export class TypeOrmSessionReader {
  constructor(private readonly manager: EntityManager) {}

  async listSessions(teacherId: number, filters: SessionListFilters): Promise<SessionSummary[]> {
    const queryBuilder = this.manager
      .getRepository(Session)
      .createQueryBuilder('session')
      .where('session.teacher_id = :teacherId', { teacherId });

    if (filters.class_id !== undefined) {
      queryBuilder.andWhere('session.class_id = :classId', { classId: filters.class_id });
    }

    if (filters.status !== undefined) {
      queryBuilder.andWhere('session.status = :status', { status: filters.status });
    }

    if (filters.from !== undefined) {
      queryBuilder.andWhere('session.scheduled_at >= :from', { from: filters.from });
    }

    if (filters.to !== undefined) {
      queryBuilder.andWhere('session.scheduled_at <= :to', { to: filters.to });
    }

    const sessions = await queryBuilder
      .orderBy('session.scheduled_at', 'ASC')
      .getMany();

    return sessions.map((session) => ({
      id: session.id,
      teacher_id: session.teacher_id,
      class_id: session.class_id,
      scheduled_at: session.scheduled_at,
      end_time: session.end_time,
      status: session.status,
      is_manual: session.is_manual,
      created_at: session.created_at,
      cancelled_at: session.cancelled_at,
    }));
  }
}
