import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { ArchiveClassUseCase } from '../../../application/commands/ArchiveClassUseCase.js';
import { CreateClassUseCase } from '../../../application/commands/CreateClassUseCase.js';
import { UpdateClassUseCase } from '../../../application/commands/UpdateClassUseCase.js';
import type { CreateClassInput } from '../../../application/dto/ClassDto.js';
import type { UpdateClassInput } from '../../../application/dto/ClassDto.js';
import { TypeOrmClassArchiveGuard } from './TypeOrmClassArchiveGuard.js';
import { TypeOrmClassRepository } from './TypeOrmClassRepository.js';
import { TypeOrmClassScheduleService } from './TypeOrmClassScheduleService.js';
import { TypeOrmClassSessionLifecycle } from './TypeOrmClassSessionLifecycle.js';

export class TypeOrmClassCommandHandlers {
  async createClass(input: {
    teacherId: number;
    name: string;
    feePerSession: string;
    schedules: CreateClassInput['schedules'];
  }) {
    return AppDataSource.transaction(async (manager) => {
      const classes = new TypeOrmClassRepository(manager);
      const classSchedules = new TypeOrmClassScheduleService(manager);
      const useCase = new CreateClassUseCase(classes, classSchedules);

      return useCase.execute(input);
    });
  }

  async updateClass(input: {
    teacherId: number;
    classId: number;
    name?: string;
    feePerSession?: string;
    schedules?: UpdateClassInput['schedules'];
  }) {
    return AppDataSource.transaction(async (manager) => {
      const classes = new TypeOrmClassRepository(manager);
      const classSchedules = new TypeOrmClassScheduleService(manager);
      const useCase = new UpdateClassUseCase(classes, classSchedules);

      return useCase.execute(input);
    });
  }

  async archiveClass(input: {
    teacherId: number;
    classId: number;
    archivedAt: Date;
  }) {
    return AppDataSource.transaction(async (manager) => {
      const classes = new TypeOrmClassRepository(manager);
      const archiveGuard = new TypeOrmClassArchiveGuard(manager);
      const sessionLifecycle = new TypeOrmClassSessionLifecycle(manager);
      const useCase = new ArchiveClassUseCase(classes, archiveGuard, sessionLifecycle);

      return useCase.execute(input);
    });
  }
}
