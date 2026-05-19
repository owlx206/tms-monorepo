import type { EntityManager } from 'typeorm';

import { Class } from '../../infrastructure/persistence/typeorm/entities/class.entity.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { TypeOrmClassScheduleService } from '../../infrastructure/persistence/typeorm/Writer.js';
import type { ClassSummary, ClassSummaryWithSchedules, CreateClassCommand } from '../../contracts/types.js';

function normalizeClassName(name: string): string {
  const normalized = name.trim();

  if (!normalized) {
    throw new HttpError('class name is required', 400);
  }

  return normalized;
}

function normalizeFeePerSession(feePerSession: string): string {
  const normalized = feePerSession.trim();

  if (!/^\d+$/.test(normalized)) {
    throw new HttpError('fee_per_session must be a non-negative integer string', 400);
  }

  return normalized;
}

export class CreateClassUseCase {
  constructor(
    private readonly manager: EntityManager,
    private readonly classSchedules: TypeOrmClassScheduleService,
  ) {}

  async execute(command: CreateClassCommand): Promise<ClassSummaryWithSchedules> {
    if (command.schedules.length === 0) {
      throw new HttpError('class must have at least one schedule', 400);
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
    const savedSchedules = await this.classSchedules.listSchedules(command.teacherId, savedClass.id);

    return {
      ...this.toSummary(savedClass),
      schedules: savedSchedules,
    };
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
