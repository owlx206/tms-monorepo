import { Between, type EntityManager } from 'typeorm';

import { Class } from '../../../../../entities/class.entity.js';
import { Session } from '../../../../../entities/session.entity.js';

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function combineDateWithEndTime(date: Date, endTime: string): Date {
  const [hours, minutes, seconds] = endTime.split(':').map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, seconds, 0);
}

function sessionOverlaps(
  sessionStart: Date,
  sessionEndTime: string,
  candidateStart: Date,
  candidateEndTime: string,
): boolean {
  const sessionEnd = combineDateWithEndTime(sessionStart, sessionEndTime);
  const candidateEnd = combineDateWithEndTime(candidateStart, candidateEndTime);

  return sessionStart < candidateEnd && candidateStart < sessionEnd;
}

export class TypeOrmSessionWriter {
  constructor(private readonly manager: EntityManager) {}

  findById(teacherId: number, sessionId: number): Promise<Session | null> {
    return this.manager.getRepository(Session).findOneBy({
      id: sessionId,
      teacher_id: teacherId,
    });
  }

  findClassById(teacherId: number, classId: number): Promise<Class | null> {
    return this.manager.getRepository(Class).findOneBy({
      id: classId,
      teacher_id: teacherId,
    });
  }

  findByTeacherClassAndScheduledAt(
    teacherId: number,
    classId: number,
    scheduledAt: Date,
  ): Promise<Session | null> {
    return this.manager.getRepository(Session).findOneBy({
      teacher_id: teacherId,
      class_id: classId,
      scheduled_at: scheduledAt,
    });
  }

  async hasOverlappingSession(
    teacherId: number,
    scheduledAt: Date,
    endTime: string,
  ): Promise<boolean> {
    const sessions = await this.manager.getRepository(Session).find({
      where: {
        teacher_id: teacherId,
        scheduled_at: Between(
          new Date(scheduledAt.getFullYear(), scheduledAt.getMonth(), scheduledAt.getDate(), 0, 0, 0, 0),
          endOfDay(scheduledAt),
        ),
      },
    });

    return sessions.some((session) => (
      !session.isCancelled()
      && session.end_time !== null
      && sessionOverlaps(session.scheduled_at, session.end_time, scheduledAt, endTime)
    ));
  }

  create(input: {
    teacher_id: number;
    class_id: number;
    scheduled_at: Date;
    end_time: string;
    status: Session['status'];
    is_manual: boolean;
    cancelled_at: null;
  }): Session {
    return this.manager.getRepository(Session).create(input);
  }

  save(session: Session): Promise<Session> {
    return this.manager.getRepository(Session).save(session);
  }
}
