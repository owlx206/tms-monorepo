import { parseAmountToBigInt } from '../../../../shared/helpers/money.js';
import type { UseCase } from '../../../../shared/application/UseCase.js';
import { DomainError } from '../../../../shared/domain/DomainError.js';
import type { EnrollmentRepository } from '../../domain/repositories/EnrollmentRepository.js';
import type { StudentRepository } from '../../domain/repositories/StudentRepository.js';
import { StudentId } from '../../domain/value-objects/StudentId.js';
import type { StudentSummary } from '../dto/StudentDto.js';
import { StudentSummaryMapper } from '../mappers/StudentSummaryMapper.js';
import type { ArchiveFinancePort } from '../ports/ArchiveFinancePort.js';
import type { BalanceSnapshotPort } from '../ports/BalanceSnapshotPort.js';
import type { ArchivePendingStudentCommand } from '../dto/ArchivePendingStudentCommand.js';

export class ArchivePendingStudentUseCase implements UseCase<ArchivePendingStudentCommand, StudentSummary> {
  constructor(
    private readonly students: StudentRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly balanceSnapshots: BalanceSnapshotPort,
    private readonly archiveFinance: ArchiveFinancePort,
  ) {}

  async execute(command: ArchivePendingStudentCommand): Promise<StudentSummary> {
    const studentId = StudentId.from(command.studentId);
    const student = await this.students.requireById(studentId);
    student.assertPendingArchive();

    let balanceSnapshot = await this.balanceSnapshots.loadForStudent(command.teacherId, command.studentId);
    let balanceAmount = parseAmountToBigInt(balanceSnapshot.balance);

    if (balanceAmount !== 0n && command.settleFinance) {
      balanceSnapshot = await this.archiveFinance.settleForArchive({
        teacherId: command.teacherId,
        studentId: command.studentId,
        archivedAt: command.archivedAt,
      });
      balanceAmount = parseAmountToBigInt(balanceSnapshot.balance);
    }

    if (balanceAmount !== 0n) {
      throw new DomainError('student_balance_must_be_zero_before_archive', 'student balance must be zero before archive');
    }

    const activeEnrollment = await this.enrollments.findActiveByStudent(command.teacherId, studentId);
    if (activeEnrollment) {
      const enrollmentSnapshot = activeEnrollment.toSnapshot();
      if (command.archivedAt <= enrollmentSnapshot.enrolledAt) {
        throw new DomainError(
          'archived_at_must_be_later_than_current_enrollment_start_time',
          'archived_at must be later than current enrollment start time',
        );
      }

      activeEnrollment.endAt(command.archivedAt);
      await this.enrollments.save(activeEnrollment);
    }

    student.archive(command.archivedAt);
    const savedStudent = await this.students.save(student);

    return StudentSummaryMapper.fromSnapshots({
      student: savedStudent.toSnapshot(),
      balance: balanceSnapshot,
      fallbackStudentId: command.studentId,
    });
  }
}
