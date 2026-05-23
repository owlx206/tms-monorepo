import { DomainError } from '../../../../shared/domain/DomainError.js';
import {
  EnrollmentPendingArchiveReason,
  EnrollmentStudentStatus,
} from '../../contracts/types.js';
import { CodeforcesHandle } from '../value-objects/CodeforcesHandle.js';
import type { StudentId } from '../value-objects/StudentId.js';

export type StudentSnapshot = {
  id: number | null;
  teacherId: number;
  fullName: string;
  codeforcesHandle: string | null;
  discordUsername: string | null;
  discordUserId: string | null;
  phone: string | null;
  note: string | null;
  status: EnrollmentStudentStatus;
  pendingArchiveReason: EnrollmentPendingArchiveReason | null;
  createdAt: Date | null;
  archivedAt: Date | null;
};

type CreateStudentProps = {
  teacherId: number;
  fullName: string;
  codeforcesHandle: CodeforcesHandle | null;
  discordUsername: string | null;
  discordUserId: string | null;
  phone: string | null;
  note: string | null;
};

export class Student {
  private constructor(
    public readonly id: StudentId | null,
    private readonly teacherId: number,
    private fullName: string,
    private codeforcesHandle: CodeforcesHandle | null,
    private discordUsername: string | null,
    private discordUserId: string | null,
    private phone: string | null,
    private note: string | null,
    private status: EnrollmentStudentStatus,
    private pendingArchiveReason: EnrollmentPendingArchiveReason | null,
    private createdAt: Date | null,
    private archivedAt: Date | null,
  ) {}

  static create(props: CreateStudentProps): Student {
    const fullName = props.fullName.trim();
    if (!fullName) {
      throw new DomainError('student_full_name_required');
    }

    return new Student(
      null,
      props.teacherId,
      fullName,
      props.codeforcesHandle,
      normalizeNullableText(props.discordUsername),
      normalizeDiscordUserId(props.discordUserId),
      normalizeNullableText(props.phone),
      normalizeNullableText(props.note),
      EnrollmentStudentStatus.Active,
      null,
      null,
      null,
    );
  }

  static restore(snapshot: StudentSnapshot, id: StudentId | null): Student {
    return new Student(
      id,
      snapshot.teacherId,
      snapshot.fullName,
      CodeforcesHandle.fromNullable(snapshot.codeforcesHandle),
      snapshot.discordUsername,
      snapshot.discordUserId,
      snapshot.phone,
      snapshot.note,
      snapshot.status,
      snapshot.pendingArchiveReason,
      snapshot.createdAt,
      snapshot.archivedAt,
    );
  }

  toSnapshot(): StudentSnapshot {
    return {
      id: this.id?.value ?? null,
      teacherId: this.teacherId,
      fullName: this.fullName,
      codeforcesHandle: this.codeforcesHandle?.value ?? null,
      discordUsername: this.discordUsername,
      discordUserId: this.discordUserId,
      phone: this.phone,
      note: this.note,
      status: this.status,
      pendingArchiveReason: this.pendingArchiveReason,
      createdAt: this.createdAt,
      archivedAt: this.archivedAt,
    };
  }

  isActive(): boolean {
    return this.status === EnrollmentStudentStatus.Active;
  }

  assertActive(): void {
    if (!this.isActive()) {
      throw new DomainError('student_is_not_active');
    }
  }

  isPendingArchive(): boolean {
    return this.status === EnrollmentStudentStatus.PendingArchive;
  }

  assertPendingArchive(): void {
    if (!this.isPendingArchive()) {
      throw new DomainError('student_is_not_pending_archive');
    }
  }

  isArchived(): boolean {
    return this.status === EnrollmentStudentStatus.Archived;
  }

  assertArchived(): void {
    if (!this.isArchived()) {
      throw new DomainError('student_is_not_archived');
    }
  }

  assertReinstatableAt(enrolledAt: Date): void {
    if (this.archivedAt && enrolledAt <= this.archivedAt) {
      throw new DomainError('enrolled_at_must_be_later_than_archived_at');
    }
  }

  rename(fullName: string): void {
    const normalized = fullName.trim();
    if (!normalized) {
      throw new DomainError('student_full_name_required');
    }

    this.fullName = normalized;
  }

  updateCodeforcesHandle(codeforcesHandle: CodeforcesHandle | null): void {
    this.codeforcesHandle = codeforcesHandle;
  }

  updateDiscordUsername(discordUsername: string | null): void {
    this.discordUsername = normalizeNullableText(discordUsername);
  }

  updateDiscordUserId(discordUserId: string | null): void {
    this.discordUserId = normalizeDiscordUserId(discordUserId);
  }

  updatePhone(phone: string | null): void {
    this.phone = normalizeNullableText(phone);
  }

  updateNote(note: string | null): void {
    this.note = normalizeNullableText(note);
  }

  markPendingArchive(reason: EnrollmentPendingArchiveReason): void {
    this.status = EnrollmentStudentStatus.PendingArchive;
    this.pendingArchiveReason = reason;
    this.archivedAt = null;
  }

  archive(archivedAt: Date): void {
    this.status = EnrollmentStudentStatus.Archived;
    this.pendingArchiveReason = null;
    this.archivedAt = archivedAt;
  }

  reinstate(): void {
    this.status = EnrollmentStudentStatus.Active;
    this.pendingArchiveReason = null;
    this.archivedAt = null;
  }

}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeDiscordUserId(value: string | null | undefined): string | null {
  const normalized = normalizeNullableText(value);
  if (!normalized) {
    return null;
  }

  const mentionMatch = /^<@!?(\d{15,25})>$/.exec(normalized);
  if (mentionMatch) {
    return mentionMatch[1];
  }

  const snowflakeMatch = /\d{15,25}/.exec(normalized);
  return snowflakeMatch ? snowflakeMatch[0] : normalized;
}
