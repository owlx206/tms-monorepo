import type { UseCase } from '../../../../shared/application/UseCase.js';
import { DomainError } from '../../../../shared/domain/DomainError.js';
import { parseAmountToBigInt } from '../../../finance/domain/Money.js';
import { EnrollmentPendingArchiveReason } from '../../contracts/types.js';
import { StudentId } from '../../domain/value-objects/StudentId.js';
import type { StudentSummary } from '../../contracts/types.js';
import { StudentSummaryMapper } from '../mappers/StudentSummaryMapper.js';
import type { TypeOrmBalanceSnapshotReader } from '../../infrastructure/persistence/typeorm/Reader.js';
import type { TypeOrmEnrollmentWriter, TypeOrmStudentWriter } from '../../infrastructure/persistence/typeorm/Writer.js';
import type { WithdrawStudentCommand } from '../../contracts/types.js';

export class WithdrawStudent implements UseCase<WithdrawStudentCommand, StudentSummary> {
  constructor(
    private readonly students: TypeOrmStudentWriter,
    private readonly enrollments: TypeOrmEnrollmentWriter,
    private readonly balanceSnapshots: TypeOrmBalanceSnapshotReader,
  ) {}

  async execute(command: WithdrawStudentCommand): Promise<StudentSummary> {
    const studentId = StudentId.from(command.studentId);
    const student = await this.students.requireById(studentId);
    student.assertActive();

    const activeEnrollment = await this.enrollments.findActiveByStudent(command.teacherId, studentId);
    if (activeEnrollment) {
      const enrollmentSnapshot = activeEnrollment.toSnapshot();
      if (command.withdrawnAt <= enrollmentSnapshot.enrolledAt) {
        throw new DomainError(
          'withdrawn_at_must_be_later_than_current_enrollment_start_time',
          'withdrawn_at must be later than current enrollment start time',
        );
      }

      activeEnrollment.endAt(command.withdrawnAt);
      await this.enrollments.save(activeEnrollment);
    }

    const balanceSnapshot = await this.balanceSnapshots.loadForStudent(command.teacherId, command.studentId);
    const balanceAmount = parseAmountToBigInt(balanceSnapshot.balance);

    if (balanceAmount < 0n) {
      student.markPendingArchive(EnrollmentPendingArchiveReason.NeedsCollection);
    } else if (balanceAmount > 0n) {
      student.markPendingArchive(EnrollmentPendingArchiveReason.NeedsRefund);
    } else {
      student.archive(command.withdrawnAt);
    }

    const savedStudent = await this.students.save(student);

    return StudentSummaryMapper.fromSnapshots({
      student: savedStudent.toSnapshot(),
      balance: balanceSnapshot,
      fallbackStudentId: command.studentId,
    });
  }
}
