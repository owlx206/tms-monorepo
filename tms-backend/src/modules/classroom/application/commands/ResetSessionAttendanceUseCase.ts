import { ClassServiceError } from '../../../../shared/errors/class.error.js';
import type { TypeOrmSessionFinanceService } from '../../infrastructure/persistence/typeorm/TypeOrmSessionFinanceService.js';
import type { TypeOrmAttendanceWriter } from '../../infrastructure/persistence/typeorm/TypeOrmAttendanceWriter.js';

type ResetSessionAttendanceCommand = {
  teacherId: number;
  sessionId: number;
};

export class ResetSessionAttendanceUseCase {
  constructor(
    private readonly attendanceWriter: TypeOrmAttendanceWriter,
    private readonly finance: TypeOrmSessionFinanceService,
  ) {}

  async execute(command: ResetSessionAttendanceCommand): Promise<void> {
    const session = await this.attendanceWriter.findSessionById(command.teacherId, command.sessionId);

    if (!session) {
      throw new ClassServiceError('session not found', 404);
    }

    const existing = await this.attendanceWriter.findAttendanceBySession(
      command.teacherId,
      command.sessionId,
    );

    if (existing.length === 0) {
      return;
    }

    await this.attendanceWriter.remove(existing);
    await this.finance.cancelFeeRecordsForSessions(command.teacherId, [session.id]);
  }
}
