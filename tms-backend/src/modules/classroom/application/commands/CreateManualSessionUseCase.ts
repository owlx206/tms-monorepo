import { ClassStatus, SessionStatus } from '../../../../entities/enums.js';
import { ClassServiceError } from '../../../../shared/errors/class.error.js';
import type {
  CreateManualSessionInput,
  SessionSummary,
} from '../dto/ClassDto.js';
import { SessionMapper } from '../../infrastructure/persistence/typeorm/SessionMapper.js';
import type { TypeOrmSessionWriter } from '../../infrastructure/persistence/typeorm/TypeOrmSessionWriter.js';

type CreateManualSessionCommand = {
  teacherId: number;
  classId: number;
  session: CreateManualSessionInput;
};

export class CreateManualSessionUseCase {
  constructor(private readonly sessions: TypeOrmSessionWriter) {}

  async execute(command: CreateManualSessionCommand): Promise<SessionSummary> {
    const classEntity = await this.sessions.findClassById(command.teacherId, command.classId);

    if (!classEntity) {
      throw new ClassServiceError('class not found', 404);
    }

    if (classEntity.status !== ClassStatus.Active) {
      throw new ClassServiceError('class is archived', 409);
    }

    if (command.session.scheduled_at.getTime() < Date.now()) {
      throw new ClassServiceError('scheduled_at must be greater than or equal to current time', 400);
    }

    const duplicated = await this.sessions.findByTeacherClassAndScheduledAt(
      command.teacherId,
      command.classId,
      command.session.scheduled_at,
    );

    if (duplicated) {
      throw new ClassServiceError('session at this datetime already exists', 409);
    }

    const hasOverlap = await this.sessions.hasOverlappingSession(
      command.teacherId,
      command.session.scheduled_at,
      command.session.end_time,
    );

    if (hasOverlap) {
      throw new ClassServiceError('Buổi học không được giao nhau với buổi học đã có', 409);
    }

    const session = this.sessions.create({
      teacher_id: command.teacherId,
      class_id: command.classId,
      scheduled_at: command.session.scheduled_at,
      end_time: command.session.end_time,
      status: SessionStatus.Scheduled,
      is_manual: true,
      cancelled_at: null,
    });

    const saved = await this.sessions.save(session);
    return SessionMapper.toSummary(saved);
  }
}
