import type {
  EnrollmentPendingArchiveReason,
  EnrollmentStudentStatus,
} from '../../domain/models/Student.js';

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
