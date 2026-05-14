import type { EntityManager } from 'typeorm';

import { Class } from '../../../../entities/class.entity.js';
import { ClassServiceError } from '../../../../shared/errors/class.error.js';
import type { TypeOrmClassScheduleService } from '../../infrastructure/persistence/typeorm/TypeOrmClassScheduleService.js';
import type { ClassSummary, CreateClassInput } from '../dto/ClassDto.js';

type CreateClassCommand = {
  teacherId: number;
  name: string;
  feePerSession: string;
  schedules: CreateClassInput['schedules'];
};

function normalizeClassName(name: string): string {
  const normalized = name.trim();

  if (!normalized) {
    throw new ClassServiceError('class name is required', 400);
  }

  return normalized;
}

function normalizeFeePerSession(feePerSession: string): string {
  const normalized = feePerSession.trim();

  if (!/^\d+$/.test(normalized)) {
    throw new ClassServiceError('fee_per_session must be a non-negative integer string', 400);
  }

  return normalized;
}

export class CreateClassUseCase {
  constructor(
    private readonly manager: EntityManager,
    private readonly classSchedules: TypeOrmClassScheduleService,
  ) {}

  async execute(command: CreateClassCommand): Promise<ClassSummary> {
    if (command.schedules.length === 0) {
      throw new ClassServiceError('class must have at least one schedule', 400);
    }

    const classRepository = this.manager.getRepository(Class);
    const classEntity = classRepository.create({
      teacher_id: command.teacherId,
      name: normalizeClassName(command.name),
      fee_per_session: normalizeFeePerSession(command.feePerSession),
    });

    const savedClass = await classRepository.save(classEntity);
    const schedules = command.schedules;

    await this.classSchedules.replaceSchedules(command.teacherId, savedClass.id, schedules);

    return this.toSummary(savedClass);
  }

  private toSummary(classEntity: Class): ClassSummary {
    return {
      id: classEntity.id,
      teacher_id: classEntity.teacher_id,
      name: classEntity.name,
      fee_per_session: classEntity.fee_per_session,
      status: classEntity.status,
      created_at: classEntity.created_at,
      archived_at: classEntity.archived_at,
    };
  }
}
