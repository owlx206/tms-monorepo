import type { EntityManager } from 'typeorm';

import { Class } from '../../../../entities/class.entity.js';
import { ClassStatus } from '../../../../entities/enums.js';
import { ClassServiceError } from '../../../../shared/errors/class.error.js';
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
    private readonly manager: EntityManager,
    private readonly archiveGuard: TypeOrmClassArchiveGuard,
    private readonly sessionLifecycle: TypeOrmClassSessionLifecycle,
  ) {}

  async execute(command: ArchiveClassCommand): Promise<ClassSummary> {
    const classRepository = this.manager.getRepository(Class);
    const classEntity = await classRepository.findOneBy({
      id: command.classId,
      teacher_id: command.teacherId,
    });

    if (!classEntity) {
      throw new ClassServiceError('class not found', 404);
    }

    if (classEntity.status === ClassStatus.Archived) {
      return this.toSummary(classEntity);
    }

    await this.archiveGuard.assertArchivable(command.teacherId, command.classId);

    classEntity.status = ClassStatus.Archived;
    classEntity.archived_at = command.archivedAt;

    const savedClass = await classRepository.save(classEntity);
    await this.sessionLifecycle.cancelUpcomingScheduledSessions(
      command.teacherId,
      command.classId,
      command.archivedAt,
    );

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
