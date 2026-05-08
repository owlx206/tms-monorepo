import type { UseCase } from '../../../../shared/application/UseCase.js';
import { DomainError } from '../../../../shared/domain/DomainError.js';
import { parseAmountToBigInt } from '../../../../shared/helpers/money.js';
import { EnrollmentPendingArchiveReason } from '../../domain/models/Student.js';
import type { EnrollmentRepository } from '../../domain/repositories/EnrollmentRepository.js';
import type { StudentRepository } from '../../domain/repositories/StudentRepository.js';
import { StudentId } from '../../domain/value-objects/StudentId.js';
import type { StudentSummary } from '../dto/StudentDto.js';
import { StudentSummaryMapper } from '../mappers/StudentSummaryMapper.js';
import type { BalanceSnapshotPort } from '../ports/BalanceSnapshotPort.js';
import type { WithdrawStudentCommand } from '../dto/WithdrawStudentCommand.js';

export class WithdrawStudentUseCase implements UseCase<WithdrawStudentCommand, StudentSummary> {
  constructor(
    private readonly students: StudentRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly balanceSnapshots: BalanceSnapshotPort,
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
    savedStudent.recordWithdrawn(command.withdrawnAt);

    return StudentSummaryMapper.fromSnapshots({
      student: savedStudent.toSnapshot(),
      balance: balanceSnapshot,
      fallbackStudentId: command.studentId,
    });
  }
}
