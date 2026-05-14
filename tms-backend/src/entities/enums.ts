export enum AttendanceSource {
  Bot = 'bot',
  Manual = 'manual',
  System = 'system',
}

export enum AttendanceStatus {
  Present = 'present',
  AbsentExcused = 'absent_excused',
  AbsentUnexcused = 'absent_unexcused',
}

export enum ClassStatus {
  Active = 'active',
  Archived = 'archived',
}

export enum FeeRecordStatus {
  Active = 'active',
  Cancelled = 'cancelled',
}

export enum PendingArchiveReason {
  NeedsCollection = 'needs_collection',
  NeedsRefund = 'needs_refund',
}

export enum SessionStatus {
  Scheduled = 'scheduled',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export enum StudentStatus {
  Active = 'active',
  PendingArchive = 'pending_archive',
  Archived = 'archived',
}

export enum TeacherRole {
  SysAdmin = 'sysadmin',
  Teacher = 'teacher',
}

export enum TransactionType {
  Payment = 'payment',
  Refund = 'refund',
}
