import type { EnrollmentSnapshot } from '../domain/models/Enrollment.js';
import type { StudentSnapshot } from '../domain/models/Student.js';

export enum EnrollmentPendingArchiveReason {
  NeedsCollection = 'needs_collection',
  NeedsRefund = 'needs_refund',
}

export enum EnrollmentStudentStatus {
  Active = 'active',
  PendingArchive = 'pending_archive',
  Archived = 'archived',
}

export {
  EnrollmentPendingArchiveReason as PendingArchiveReason,
  EnrollmentStudentStatus as StudentStatus,
};

export type StudentListFilters = {
  status?: EnrollmentStudentStatus;
  pending_archive_reason?: EnrollmentPendingArchiveReason;
  class_id?: number;
  search?: string;
};

export type CreateStudentInput = {
  full_name: string;
  class_id: number;
  codeforces_handle: string;
  phone: string | null;
  note: string | null;
  enrolled_at: Date;
};

export type UpdateStudentInput = {
  full_name?: string;
  codeforces_handle?: string;
  phone?: string | null;
  note?: string | null;
};

export type ReinstateStudentInput = {
  class_id: number;
  enrolled_at: Date;
};

export type TransferStudentInput = {
  to_class_id: number;
  transferred_at: Date;
};

export type WithdrawStudentInput = {
  withdrawn_at: Date;
};

export type ArchivePendingStudentInput = {
  archived_at: Date;
};

export type StudentMessageInput = {
  content: string;
  student_ids?: number[];
  class_id?: number;
};

export type DeliveryStatus = 'sent' | 'failed';

export type StudentEnrollmentSummary = {
  id: number;
  teacher_id: number;
  student_id: number;
  class_id: number;
  enrolled_at: Date;
  unenrolled_at: Date | null;
};

export type StudentBalanceSnapshot = {
  transactions_total: string;
  active_fee_total: string;
  balance: string;
};

export type StudentSummary = {
  id: number;
  teacher_id: number;
  full_name: string;
  codeforces_handle: string | null;
  discord_username: string | null;
  discord_user_id: string | null;
  phone: string | null;
  note: string | null;
  status: EnrollmentStudentStatus;
  pending_archive_reason: EnrollmentPendingArchiveReason | null;
  created_at: Date;
  archived_at: Date | null;
  current_class_id: number | null;
  current_enrollment_id: number | null;
  transactions_total: string;
  active_fee_total: string;
  balance: string;
};

export type CreateStudentCommand = {
  teacherId: number;
  fullName: string;
  classId: number;
  codeforcesHandle: string;
  phone: string | null;
  note: string | null;
  enrolledAt: Date;
};

export type UpdateStudentCommand = {
  teacherId: number;
  studentId: number;
  fullName?: string;
  codeforcesHandle?: string;
  phone?: string | null;
  note?: string | null;
};

export type TransferStudentCommand = {
  teacherId: number;
  studentId: number;
  toClassId: number;
  transferredAt: Date;
};

export type WithdrawStudentCommand = {
  teacherId: number;
  studentId: number;
  withdrawnAt: Date;
};

export type ReinstateStudentCommand = {
  teacherId: number;
  studentId: number;
  classId: number;
  enrolledAt: Date;
};

export type ArchivePendingStudentCommand = {
  teacherId: number;
  studentId: number;
  archivedAt: Date;
};

export type DashboardReader = {
  countActiveStudents(teacherId: number): Promise<number>;
  countActiveClasses(teacherId: number): Promise<number>;
};

export type StudentLearningProfileStanding = {
  topic_id: number;
  problem_id: number;
  solved: boolean;
  penalty_minutes: number | null;
  pulled_at: Date;
};

export type StudentLearningProfileTopic = {
  id: number;
  title: string;
  class_id: number;
  gym_link: string | null;
  gym_id: string | null;
  closed_at: Date | null;
};

export type StudentLearningProfileProblem = {
  id: number;
  problem_index: string;
  problem_name: string | null;
};

export type StudentLearningProfileClass = {
  id: number;
  name: string;
};

export type StudentLearningProfileSource = {
  student: unknown;
  standings: StudentLearningProfileStanding[];
  topics: StudentLearningProfileTopic[];
  problems: StudentLearningProfileProblem[];
  classes: StudentLearningProfileClass[];
};

export type StudentLearningProfileReader = {
  getStudentLearningProfileSource(
    teacherId: number,
    studentId: number,
  ): Promise<StudentLearningProfileSource>;
};

export type StudentSummaryMappingInput = {
  student: StudentSnapshot;
  enrollment?: EnrollmentSnapshot | null;
  balance?: StudentBalanceSnapshot;
  fallbackStudentId?: number;
};
