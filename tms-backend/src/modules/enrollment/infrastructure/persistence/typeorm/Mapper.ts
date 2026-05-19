import { Enrollment } from '../../../domain/models/Enrollment.js';
import { EnrollmentId } from '../../../domain/value-objects/EnrollmentId.js';
import { Enrollment as EnrollmentOrmEntity } from './entities/enrollment.entity.js';
import { EnrollmentPendingArchiveReason, EnrollmentStudentStatus, PendingArchiveReason, type StudentBalanceSnapshot, StudentStatus, type StudentSummary } from '../../../contracts/types.js';
import { Student as DomainStudent } from '../../../domain/models/Student.js';
import { StudentId } from '../../../domain/value-objects/StudentId.js';
import { Student as StudentOrmEntity } from './entities/student.entity.js';

// EnrollmentMapper.ts
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

// StudentMapper.ts
export class StudentMapper {
  toDomain(entity: StudentOrmEntity): DomainStudent {
    return DomainStudent.restore(
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

  toPersistence(student: DomainStudent, entity = new StudentOrmEntity()): StudentOrmEntity {
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

// StudentSummaryMapper.ts
export function toStudentSummary(
  student: StudentOrmEntity,
  context: {
    current_class_id: number | null;
    current_enrollment_id: number | null;
    balance_snapshot: StudentBalanceSnapshot;
  },
): StudentSummary {
  return {
    id: student.id,
    teacher_id: student.teacher_id,
    full_name: student.full_name,
    codeforces_handle: student.codeforces_handle,
    discord_username: student.discord_username,
    discord_user_id: student.discord_user_id,
    phone: student.phone,
    note: student.note,
    status: student.status as unknown as EnrollmentStudentStatus,
    pending_archive_reason: student.pending_archive_reason as unknown as EnrollmentPendingArchiveReason | null,
    created_at: student.created_at,
    archived_at: student.archived_at,
    current_class_id: context.current_class_id,
    current_enrollment_id: context.current_enrollment_id,
    transactions_total: context.balance_snapshot.transactions_total,
    active_fee_total: context.balance_snapshot.active_fee_total,
    balance: context.balance_snapshot.balance,
  };
}
