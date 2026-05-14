import { ClassStatus } from '../../../../../entities/enums.js';
import { ClassroomClass } from '../../../domain/models/Class.js';
import { Class } from '../../../../../entities/class.entity.js';

export class ClassMapper {
  static toDomain(entity: Class): ClassroomClass {
    return ClassroomClass.restore({
      id: entity.id,
      teacherId: entity.teacher_id,
      name: entity.name,
      feePerSession: entity.fee_per_session,
      status: entity.status,
      createdAt: entity.created_at,
      archivedAt: entity.archived_at,
    });
  }

  static toOrmEntity(entity: Class, classroomClass: ClassroomClass): Class {
    const snapshot = classroomClass.toSnapshot();

    entity.teacher_id = snapshot.teacherId;
    entity.name = snapshot.name;
    entity.fee_per_session = snapshot.feePerSession;
    entity.status = snapshot.status ?? ClassStatus.Active;
    entity.archived_at = snapshot.archivedAt;

    return entity;
  }
}
