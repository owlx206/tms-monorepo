import type { Class } from '../../../../../entities/class.entity.js';
import type { Session } from '../../../../../entities/session.entity.js';

export interface SessionRepository {
  findById(teacherId: number, sessionId: number): Promise<Session | null>;
  findClassById(teacherId: number, classId: number): Promise<Class | null>;
  findByTeacherClassAndScheduledAt(
    teacherId: number,
    classId: number,
    scheduledAt: Date,
  ): Promise<Session | null>;
  hasOverlappingSession(teacherId: number, scheduledAt: Date, endTime: string): Promise<boolean>;
  create(input: {
    teacher_id: number;
    class_id: number;
    scheduled_at: Date;
    end_time: string;
    status: Session['status'];
    is_manual: boolean;
    cancelled_at: null;
  }): Session;
  save(session: Session): Promise<Session>;
}
