import { ClassServiceError } from '../../../../shared/errors/class.error.js';
import type { ClassroomClass } from '../../domain/models/Class.js';
import type { ClassRepository } from '../../infrastructure/persistence/typeorm/ClassRepository.js';
import type { TypeOrmClassArchiveGuard } from '../../infrastructure/persistence/typeorm/TypeOrmClassArchiveGuard.js';
import type { TypeOrmClassSessionLifecycle } from '../../infrastructure/persistence/typeorm/TypeOrmClassSessionLifecycle.js';
import type { ClassSummary } from '../dto/ClassDto.js';

type ArchiveClassCommand = {
  teacherId: number;
  classId: number;
  archivedAt: Date;
};

export class ArchiveClassUseCase {
  constructor(
    private readonly classes: ClassRepository,
    private readonly archiveGuard: TypeOrmClassArchiveGuard,
    private readonly sessionLifecycle: TypeOrmClassSessionLifecycle,
  ) {}

  async execute(command: ArchiveClassCommand): Promise<ClassSummary> {
    const classroomClass = await this.classes.findById(command.classId);

    if (!classroomClass) {
      throw new ClassServiceError('class not found', 404);
    }

    const snapshot = classroomClass.toSnapshot();
    if (snapshot.status === 'archived') {
      return this.toSummary(classroomClass);
    }

    await this.archiveGuard.assertArchivable(command.teacherId, command.classId);

    classroomClass.archive(command.archivedAt);

    const savedClass = await this.classes.save(classroomClass);
    await this.sessionLifecycle.cancelUpcomingScheduledSessions(
      command.teacherId,
      command.classId,
      command.archivedAt,
    );

    return this.toSummary(savedClass);
  }

  private toSummary(classroomClass: ClassroomClass): ClassSummary {
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
