import type { SessionListFilters, SessionSummary } from '../dto/ClassDto.js';

type SessionReader = {
  listSessions(teacherId: number, filters: SessionListFilters): Promise<SessionSummary[]>;
};

export class SessionUseCase {
  constructor(private readonly sessions: SessionReader) {}

  list(teacherId: number, filters: SessionListFilters): Promise<SessionSummary[]> {
    return this.sessions.listSessions(teacherId, filters);
  }

  listForClass(
    teacherId: number,
    classId: number,
    filters: Omit<SessionListFilters, 'class_id'>,
  ): Promise<SessionSummary[]> {
    return this.sessions.listSessions(teacherId, {
      ...filters,
      class_id: classId,
    });
  }
}
