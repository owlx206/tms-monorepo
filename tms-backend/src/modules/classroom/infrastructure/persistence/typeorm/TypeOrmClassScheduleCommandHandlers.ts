import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { ClassScheduleUseCase } from '../../../application/commands/ClassScheduleUseCase.js';
import type {
  ClassScheduleInput,
} from '../../../application/dto/ClassDto.js';
import { TypeOrmClassScheduleRepository } from './TypeOrmClassScheduleRepository.js';
import { TypeOrmClassScheduleSessionGenerator } from './TypeOrmClassScheduleSessionGenerator.js';

export class TypeOrmClassScheduleCommandHandlers {
  async createClassSchedule(input: {
    teacherId: number;
    classId: number;
    schedule: ClassScheduleInput;
  }) {
    return AppDataSource.transaction(async (manager) => {
      const schedules = new TypeOrmClassScheduleRepository(manager);
      const sessionGeneration = new TypeOrmClassScheduleSessionGenerator(manager);
      const useCase = new ClassScheduleUseCase(schedules, sessionGeneration);
      return useCase.create(input);
    });
  }

  async updateClassSchedule(input: {
    teacherId: number;
    classId: number;
    scheduleId: number;
    schedule: Partial<ClassScheduleInput>;
  }) {
    return AppDataSource.transaction(async (manager) => {
      const schedules = new TypeOrmClassScheduleRepository(manager);
      const sessionGeneration = new TypeOrmClassScheduleSessionGenerator(manager);
      const useCase = new ClassScheduleUseCase(schedules, sessionGeneration);
      return useCase.update(input);
    });
  }

  async deleteClassSchedule(input: {
    teacherId: number;
    classId: number;
    scheduleId: number;
  }) {
    return AppDataSource.transaction(async (manager) => {
      const schedules = new TypeOrmClassScheduleRepository(manager);
      const sessionGeneration = new TypeOrmClassScheduleSessionGenerator(manager);
      const useCase = new ClassScheduleUseCase(schedules, sessionGeneration);
      return useCase.delete(input);
    });
  }
}
