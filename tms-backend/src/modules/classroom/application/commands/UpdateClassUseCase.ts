import { ClassServiceError } from '../../../../shared/errors/class.error.js';
import type { ClassRepository } from '../../infrastructure/persistence/typeorm/ClassRepository.js';
import type { TypeOrmClassScheduleService } from '../../infrastructure/persistence/typeorm/TypeOrmClassScheduleService.js';
import type { ClassSummary, UpdateClassInput } from '../dto/ClassDto.js';

type UpdateClassCommand = {
  teacherId: number;
  classId: number;
  name?: string;
  feePerSession?: string;
  schedules?: UpdateClassInput['schedules'];
};

export class UpdateClassUseCase {
  constructor(
    private readonly classes: ClassRepository,
    private readonly classSchedules: TypeOrmClassScheduleService,
  ) {}

  async execute(command: UpdateClassCommand): Promise<ClassSummary> {
    const classroomClass = await this.classes.findById(command.classId);

    if (!classroomClass) {
      throw new ClassServiceError('class not found', 404);
    }

    const snapshot = classroomClass.toSnapshot();
    if (snapshot.status !== 'active') {
      throw new ClassServiceError('class is archived', 409);
    }

    if (command.name !== undefined) {
      classroomClass.rename(command.name);
    }

    if (command.feePerSession !== undefined) {
      classroomClass.updateFeePerSession(command.feePerSession);
    }

    const savedClass = await this.classes.save(classroomClass);

    if (command.schedules !== undefined) {
      await this.classSchedules.replaceSchedules(command.teacherId, command.classId, command.schedules);
    }

    return this.toSummary(savedClass);
  }

  private toSummary(classroomClass: import('../../domain/models/Class.js').ClassroomClass): ClassSummary {
    const snapshot = classroomClass.toSnapshot();

    if (snapshot.id === null || snapshot.createdAt === null) {
      throw new Error('saved class is missing persistence fields');
    }

    return {
      id: snapshot.id,
      teacher_id: snapshot.teacherId,
      name: snapshot.name,
      fee_per_session: snapshot.feePerSession,
      status: snapshot.status,
      created_at: snapshot.createdAt,
      archived_at: snapshot.archivedAt,
    };
  }
}
