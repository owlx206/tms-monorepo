import type { SessionSummary } from '../../../application/dto/ClassDto.js';
import type { Session } from '../../../../../entities/session.entity.js';

export class SessionMapper {
  static toSummary(session: Session): SessionSummary {
    return {
      id: session.id,
      teacher_id: session.teacher_id,
      class_id: session.class_id,
      scheduled_at: session.scheduled_at,
      end_time: session.end_time,
      status: session.status,
      is_manual: session.is_manual,
      created_at: session.created_at,
      cancelled_at: session.cancelled_at,
    };
  }
}
