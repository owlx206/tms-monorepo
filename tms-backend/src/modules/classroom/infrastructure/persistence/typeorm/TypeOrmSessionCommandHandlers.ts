import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { CancelSessionUseCase } from '../../../application/commands/CancelSessionUseCase.js';
import { CreateManualSessionUseCase } from '../../../application/commands/CreateManualSessionUseCase.js';
import type { CreateManualSessionInput, SessionSummary } from '../../../application/dto/ClassDto.js';
import { TypeOrmSessionFinanceService } from './TypeOrmSessionFinanceService.js';
import { TypeOrmSessionRepository } from './TypeOrmSessionRepository.js';

export class TypeOrmSessionCommandHandlers {
  async createManualSession(input: {
    teacherId: number;
    classId: number;
    session: CreateManualSessionInput;
  }): Promise<SessionSummary> {
    return AppDataSource.transaction(async (manager) => {
      const sessions = new TypeOrmSessionRepository(manager);
      const useCase = new CreateManualSessionUseCase(sessions);
      return useCase.execute(input);
    });
  }

  async cancelSession(input: {
    teacherId: number;
    sessionId: number;
  }): Promise<SessionSummary> {
    return AppDataSource.transaction(async (manager) => {
      const sessions = new TypeOrmSessionRepository(manager);
      const finance = new TypeOrmSessionFinanceService(manager);
      const useCase = new CancelSessionUseCase(sessions, finance);
      return useCase.execute({
        ...input,
        cancelledAt: new Date(),
      });
    });
  }
}
