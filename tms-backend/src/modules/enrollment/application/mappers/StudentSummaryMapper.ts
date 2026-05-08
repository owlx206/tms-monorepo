import type { EnrollmentSnapshot } from '../../domain/models/Enrollment.js';
import type {
  EnrollmentPendingArchiveReason,
  EnrollmentStudentStatus,
  StudentSnapshot,
} from '../../domain/models/Student.js';
import type { StudentBalanceSnapshot, StudentSummary } from '../dto/StudentDto.js';

const zeroBalanceSnapshot: StudentBalanceSnapshot = {
  transactions_total: '0',
  active_fee_total: '0',
  balance: '0',
};

type StudentSummaryMappingInput = {
  student: StudentSnapshot;
  enrollment?: EnrollmentSnapshot | null;
  balance?: StudentBalanceSnapshot;
  fallbackStudentId?: number;
};

export class StudentSummaryMapper {
  static fromSnapshots(input: StudentSummaryMappingInput): StudentSummary {
    const balance = input.balance ?? zeroBalanceSnapshot;
    const studentId = input.student.id ?? input.fallbackStudentId;

    if (studentId === undefined || studentId === null) {
      throw new Error('student_id_missing_for_summary');
    }

    return {
      id: studentId,
      teacher_id: input.student.teacherId,
      full_name: input.student.fullName,
      codeforces_handle: input.student.codeforcesHandle,
      discord_username: input.student.discordUsername,
      discord_user_id: input.student.discordUserId,
      phone: input.student.phone,
      note: input.student.note,
      status: input.student.status as EnrollmentStudentStatus,
      pending_archive_reason: input.student.pendingArchiveReason as EnrollmentPendingArchiveReason | null,
      created_at: input.student.createdAt ?? new Date(),
      archived_at: input.student.archivedAt,
      current_class_id: input.enrollment?.classId ?? null,
      current_enrollment_id: input.enrollment?.id ?? null,
      transactions_total: balance.transactions_total,
      active_fee_total: balance.active_fee_total,
      balance: balance.balance,
    };
  }
}
