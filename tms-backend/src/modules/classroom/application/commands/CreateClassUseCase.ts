import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { TypeOrmClassScheduleService, TypeOrmClassWriter } from '../../infrastructure/persistence/typeorm/Writer.js';
import type { ClassSummaryWithSchedules, CreateClassCommand } from '../../contracts/types.js';

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
    private readonly classes: TypeOrmClassWriter,
    private readonly classSchedules: TypeOrmClassScheduleService,
  ) {}

  async execute(command: CreateClassCommand): Promise<ClassSummaryWithSchedules> {
    if (command.schedules.length === 0) {
      throw new HttpError('class must have at least one schedule', 400);
    }

    const savedClass = await this.classes.createClass({
      teacherId: command.teacherId,
      name: normalizeClassName(command.name),
      feePerSession: normalizeFeePerSession(command.feePerSession),
    });

    const schedules = command.schedules;

    await this.classSchedules.replaceSchedules(command.teacherId, savedClass.id, schedules);
    const savedSchedules = await this.classSchedules.listSchedules(command.teacherId, savedClass.id);

    return {
      ...savedClass,
      schedules: savedSchedules,
    };
  }
}
