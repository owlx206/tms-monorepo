import { Entity } from '../../../../shared/domain/Entity.js';
import { DomainError } from '../../../../shared/domain/DomainError.js';
import type { EnrollmentId } from '../value-objects/EnrollmentId.js';
import { StudentId } from '../value-objects/StudentId.js';

export type EnrollmentSnapshot = {
  id: number | null;
  teacherId: number;
  studentId: number;
  classId: number;
  enrolledAt: Date;
  unenrolledAt: Date | null;
};

type CreateEnrollmentProps = {
  teacherId: number;
  studentId: StudentId;
  classId: number;
  enrolledAt: Date;
};

export class Enrollment extends Entity<EnrollmentId | null> {
  private constructor(
    id: EnrollmentId | null,
    private readonly teacherId: number,
    private readonly studentId: StudentId,
    private readonly classId: number,
    private readonly enrolledAt: Date,
    private unenrolledAt: Date | null,
  ) {
    super(id);
  }

  static create(props: CreateEnrollmentProps): Enrollment {
    if (!Number.isInteger(props.classId) || props.classId <= 0) {
      throw new DomainError('invalid_class_id');
    }

    return new Enrollment(
      null,
      props.teacherId,
      props.studentId,
      props.classId,
      props.enrolledAt,
      null,
    );
  }

  static restore(snapshot: EnrollmentSnapshot, id: EnrollmentId | null): Enrollment {
    return new Enrollment(
      id,
      snapshot.teacherId,
      StudentId.from(snapshot.studentId),
      snapshot.classId,
      snapshot.enrolledAt,
      snapshot.unenrolledAt,
    );
  }

  toSnapshot(): EnrollmentSnapshot {
    return {
      id: this.id?.value ?? null,
      teacherId: this.teacherId,
      studentId: this.studentId.value,
      classId: this.classId,
      enrolledAt: this.enrolledAt,
      unenrolledAt: this.unenrolledAt,
    };
  }

  isActive(): boolean {
    return this.unenrolledAt === null;
  }

  assertTransferableTo(classId: number, transferredAt: Date): void {
    if (this.classId === classId) {
      throw new DomainError('student_already_enrolled_in_class');
    }

    if (transferredAt <= this.enrolledAt) {
      throw new DomainError('transferred_at_must_be_later_than_current_enrollment_start_time');
    }
  }

  endAt(unenrolledAt: Date): void {
    if (unenrolledAt <= this.enrolledAt) {
      throw new DomainError('unenrolled_at_must_be_later_than_enrolled_at');
    }

    this.unenrolledAt = unenrolledAt;
  }
}
