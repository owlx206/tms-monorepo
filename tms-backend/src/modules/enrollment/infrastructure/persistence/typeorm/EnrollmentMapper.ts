import { Enrollment } from '../../../domain/models/Enrollment.js';
import { EnrollmentId } from '../../../domain/value-objects/EnrollmentId.js';
import { Enrollment as EnrollmentOrmEntity } from '../../../../../entities/enrollment.entity.js';

export class EnrollmentMapper {
  toPersistence(enrollment: Enrollment, entity = new EnrollmentOrmEntity()): EnrollmentOrmEntity {
    const snapshot = enrollment.toSnapshot();

    if (snapshot.id !== null) {
      entity.id = snapshot.id;
    }

    entity.teacher_id = snapshot.teacherId;
    entity.student_id = snapshot.studentId;
    entity.class_id = snapshot.classId;
    entity.enrolled_at = snapshot.enrolledAt;
    entity.unenrolled_at = snapshot.unenrolledAt;

    return entity;
  }

  toDomain(entity: EnrollmentOrmEntity): Enrollment {
    return Enrollment.restore(
      {
        id: entity.id,
        teacherId: entity.teacher_id,
        studentId: entity.student_id,
        classId: entity.class_id,
        enrolledAt: entity.enrolled_at,
        unenrolledAt: entity.unenrolled_at,
      },
      EnrollmentId.from(entity.id),
    );
  }
}
