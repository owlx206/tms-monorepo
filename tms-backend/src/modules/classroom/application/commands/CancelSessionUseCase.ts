import { ClassServiceError } from '../../../../shared/errors/class.error.js';
import type { SessionSummary } from '../dto/ClassDto.js';
import type { TypeOrmSessionFinanceService } from '../../infrastructure/persistence/typeorm/TypeOrmSessionFinanceService.js';
import { SessionMapper } from '../../infrastructure/persistence/typeorm/SessionMapper.js';
import type { TypeOrmSessionWriter } from '../../infrastructure/persistence/typeorm/TypeOrmSessionWriter.js';

type CancelSessionCommand = {
  teacherId: number;
  sessionId: number;
  cancelledAt: Date;
};

export class CancelSessionUseCase {
  constructor(
    private readonly sessions: TypeOrmSessionWriter,
    private readonly finance: TypeOrmSessionFinanceService,
  ) {}

  async execute(command: CancelSessionCommand): Promise<SessionSummary> {
    const session = await this.sessions.findById(command.teacherId, command.sessionId);

    if (!session) {
      throw new ClassServiceError('session not found', 404);
    }

    if (session.isCancelled()) {
      return SessionMapper.toSummary(session);
    }

    session.cancel(command.cancelledAt);
    const saved = await this.sessions.save(session);

    await this.finance.cancelFeeRecordsForSessions(
      command.teacherId,
      [saved.id],
      command.cancelledAt,
    );

    return SessionMapper.toSummary(saved);
  }
}
