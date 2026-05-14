import { ClassStatus } from '../../../../entities/enums.js';
import { ClassServiceError } from '../../../../shared/errors/class.error.js';
import { ClassScheduleMapper } from '../../infrastructure/persistence/typeorm/ClassScheduleMapper.js';
import type { TypeOrmClassScheduleWriter } from '../../infrastructure/persistence/typeorm/TypeOrmClassScheduleWriter.js';
import type { TypeOrmClassScheduleSessionGenerator } from '../../infrastructure/persistence/typeorm/TypeOrmClassScheduleSessionGenerator.js';
import type {
  ClassScheduleInput,
  ClassScheduleSummary,
} from '../dto/ClassDto.js';

type CreateClassScheduleCommand = {
  teacherId: number;
  classId: number;
  schedule: ClassScheduleInput;
};

type UpdateClassScheduleCommand = {
  teacherId: number;
  classId: number;
  scheduleId: number;
  schedule: Partial<ClassScheduleInput>;
};

type DeleteClassScheduleCommand = {
  teacherId: number;
  classId: number;
  scheduleId: number;
};

export class ClassScheduleUseCase {
  constructor(
    private readonly schedules: TypeOrmClassScheduleWriter,
    private readonly sessionGeneration: TypeOrmClassScheduleSessionGenerator,
  ) {}

  async create(command: CreateClassScheduleCommand): Promise<{ schedule: ClassScheduleSummary; sessions_created: number }> {
    await this.assertActiveClass(command.teacherId, command.classId);
    this.assertScheduleTimeRange(command.schedule);
    await this.assertNoOverlaps(command.teacherId, command.classId, [command.schedule]);

    const schedule = this.schedules.create({
      teacher_id: command.teacherId,
      class_id: command.classId,
      day_of_week: command.schedule.day_of_week,
      start_time: command.schedule.start_time,
      end_time: command.schedule.end_time,
    });

    const saved = await this.schedules.save(schedule);
    const result = await this.sessionGeneration.reconcileGeneratedSessionsForClass(
      command.teacherId,
      command.classId,
    );

    return {
      schedule: ClassScheduleMapper.toSummary(saved),
      sessions_created: result.sessions_created,
    };
  }

  async update(command: UpdateClassScheduleCommand): Promise<{ schedule: ClassScheduleSummary; sessions_created: number }> {
    await this.assertActiveClass(command.teacherId, command.classId);

    const schedule = await this.schedules.findByIdForClass(
      command.teacherId,
      command.classId,
      command.scheduleId,
    );

    if (!schedule) {
      throw new ClassServiceError('class schedule not found', 404);
    }

    if (command.schedule.day_of_week !== undefined) {
      schedule.day_of_week = command.schedule.day_of_week;
    }
    if (command.schedule.start_time !== undefined) {
      schedule.start_time = command.schedule.start_time;
    }
    if (command.schedule.end_time !== undefined) {
      schedule.end_time = command.schedule.end_time;
    }

    const nextSchedule = {
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
    };

    this.assertScheduleTimeRange(nextSchedule);
    await this.assertNoOverlaps(command.teacherId, command.classId, [nextSchedule], command.scheduleId);

    const saved = await this.schedules.save(schedule);
    const result = await this.sessionGeneration.reconcileGeneratedSessionsForClass(
      command.teacherId,
      command.classId,
    );

    return {
      schedule: ClassScheduleMapper.toSummary(saved),
      sessions_created: result.sessions_created,
    };
  }

  async delete(command: DeleteClassScheduleCommand): Promise<void> {
    await this.assertActiveClass(command.teacherId, command.classId);

    const schedule = await this.schedules.findByIdForClass(
      command.teacherId,
      command.classId,
      command.scheduleId,
    );

    if (!schedule) {
      throw new ClassServiceError('class schedule not found', 404);
    }

    const scheduleCount = await this.schedules.countByClass(command.teacherId, command.classId);
    if (scheduleCount <= 1) {
      throw new ClassServiceError('class must have at least one schedule', 409);
    }

    await this.schedules.remove(schedule);
    await this.sessionGeneration.reconcileGeneratedSessionsForClass(
      command.teacherId,
      command.classId,
    );
  }

  private async assertActiveClass(teacherId: number, classId: number): Promise<void> {
    const classEntity = await this.schedules.findClassById(teacherId, classId);

    if (!classEntity) {
      throw new ClassServiceError('class not found', 404);
    }

    if (classEntity.status !== ClassStatus.Active) {
      throw new ClassServiceError('class is archived', 409);
    }
  }

  private async assertNoOverlaps(
    teacherId: number,
    classId: number,
    schedules: ClassScheduleInput[],
    excludeScheduleId?: number,
  ): Promise<void> {
    const hasScheduleOverlap = await this.schedules.hasOverlappingPersistedSchedule(
      teacherId,
      schedules[0],
      excludeScheduleId ? { excludeScheduleId } : undefined,
    );

    if (hasScheduleOverlap) {
      throw new ClassServiceError('Lịch học không được giao nhau', 409);
    }

    const hasSessionOverlap = await this.schedules.hasOverlappingUpcomingSessions(
      teacherId,
      classId,
      schedules,
    );

    if (hasSessionOverlap) {
      throw new ClassServiceError('Lịch học bị trùng với buổi học đã có', 409);
    }
  }

  private assertScheduleTimeRange(schedule: ClassScheduleInput): void {
    if (schedule.end_time <= schedule.start_time) {
      throw new ClassServiceError('end_time must be later than start_time', 400);
    }
  }
}
