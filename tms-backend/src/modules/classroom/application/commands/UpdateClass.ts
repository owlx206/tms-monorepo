import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { TypeOrmClassScheduleService, TypeOrmClassWriter } from '../../infrastructure/persistence/typeorm/Writer.js';
import type { ClassSummaryWithSchedules, UpdateClassCommand } from '../../contracts/types.js';

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

export class UpdateClass {
  constructor(
    private readonly classes: TypeOrmClassWriter,
    private readonly classSchedules: TypeOrmClassScheduleService,
  ) {}

  async execute(command: UpdateClassCommand): Promise<ClassSummaryWithSchedules> {
    const savedClass = await this.classes.updateClass({
      teacherId: command.teacherId,
      classId: command.classId,
      name: command.name === undefined ? undefined : normalizeClassName(command.name),
      feePerSession: command.feePerSession === undefined ? undefined : normalizeFeePerSession(command.feePerSession),
    });

    if (command.schedules !== undefined) {
      await this.classSchedules.replaceSchedules(command.teacherId, command.classId, command.schedules);
    }
    const schedules = await this.classSchedules.listSchedules(command.teacherId, command.classId);

    return {
      ...savedClass,
      schedules,
    };
  }
}
