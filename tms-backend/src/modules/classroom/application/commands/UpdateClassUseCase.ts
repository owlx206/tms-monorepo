import type { EntityManager } from 'typeorm';

import { Class } from '../../../../entities/class.entity.js';
import { ClassStatus } from '../../../../entities/enums.js';
import { ClassServiceError } from '../../../../shared/errors/class.error.js';
import type { TypeOrmClassScheduleService } from '../../infrastructure/persistence/typeorm/TypeOrmClassScheduleService.js';
import type { ClassSummary, ClassSummaryWithSchedules, UpdateClassInput } from '../dto/ClassDto.js';

type UpdateClassCommand = {
  teacherId: number;
  classId: number;
  name?: string;
  feePerSession?: string;
  schedules?: UpdateClassInput['schedules'];
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

export class UpdateClassUseCase {
  constructor(
    private readonly manager: EntityManager,
    private readonly classSchedules: TypeOrmClassScheduleService,
  ) {}

  async execute(command: UpdateClassCommand): Promise<ClassSummaryWithSchedules> {
    const classRepository = this.manager.getRepository(Class);
    const classEntity = await classRepository.findOneBy({
      id: command.classId,
      teacher_id: command.teacherId,
    });

    if (!classEntity) {
      throw new ClassServiceError('class not found', 404);
    }

    if (classEntity.status !== ClassStatus.Active) {
      throw new ClassServiceError('class is archived', 409);
    }

    if (command.name !== undefined) {
      classEntity.name = normalizeClassName(command.name);
    }

    if (command.feePerSession !== undefined) {
      classEntity.fee_per_session = normalizeFeePerSession(command.feePerSession);
    }

    const savedClass = await classRepository.save(classEntity);

    if (command.schedules !== undefined) {
      await this.classSchedules.replaceSchedules(command.teacherId, command.classId, command.schedules);
    }
    const schedules = await this.classSchedules.listSchedules(command.teacherId, command.classId);

    return {
      ...this.toSummary(savedClass),
      schedules,
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
