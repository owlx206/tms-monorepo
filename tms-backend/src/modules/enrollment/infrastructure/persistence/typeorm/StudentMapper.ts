import { PendingArchiveReason, StudentStatus } from '../../../../../entities/enums.js';
import {
  EnrollmentPendingArchiveReason,
  EnrollmentStudentStatus,
  Student,
} from '../../../domain/models/Student.js';
import { StudentId } from '../../../domain/value-objects/StudentId.js';
import { Student as StudentOrmEntity } from '../../../../../entities/student.entity.js';

export class StudentMapper {
  toDomain(entity: StudentOrmEntity): Student {
    return Student.restore(
      {
        id: entity.id,
        teacherId: entity.teacher_id,
        fullName: entity.full_name,
        codeforcesHandle: entity.codeforces_handle,
        discordUsername: entity.discord_username,
        discordUserId: entity.discord_user_id,
        phone: entity.phone,
        note: entity.note,
        status: entity.status as unknown as EnrollmentStudentStatus,
        pendingArchiveReason: entity.pending_archive_reason as unknown as EnrollmentPendingArchiveReason | null,
        createdAt: entity.created_at,
        archivedAt: entity.archived_at,
      },
      StudentId.from(entity.id),
    );
  }

  toPersistence(student: Student, entity = new StudentOrmEntity()): StudentOrmEntity {
    const snapshot = student.toSnapshot();

    if (snapshot.id !== null) {
      entity.id = snapshot.id;
    }

    entity.teacher_id = snapshot.teacherId;
    entity.full_name = snapshot.fullName;
    entity.codeforces_handle = snapshot.codeforcesHandle;
    entity.discord_username = snapshot.discordUsername;
    entity.discord_user_id = snapshot.discordUserId;
    entity.phone = snapshot.phone;
    entity.note = snapshot.note;
    entity.status = snapshot.status as unknown as StudentStatus;
    entity.pending_archive_reason = snapshot.pendingArchiveReason as unknown as PendingArchiveReason | null;
    entity.created_at = snapshot.createdAt ?? entity.created_at;
    entity.archived_at = snapshot.archivedAt;

    return entity;
  }
}
