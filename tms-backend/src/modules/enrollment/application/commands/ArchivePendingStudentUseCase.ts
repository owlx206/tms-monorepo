import { parseAmountToBigInt } from '../../../../shared/helpers/money.js';
import type { UseCase } from '../../../../shared/application/UseCase.js';
import { DomainError } from '../../../../shared/domain/DomainError.js';
import type { EnrollmentWriter } from '../../domain/writers/EnrollmentWriter.js';
import type { StudentWriter } from '../../domain/writers/StudentWriter.js';
import { StudentId } from '../../domain/value-objects/StudentId.js';
import type { StudentSummary } from '../dto/StudentDto.js';
import { StudentSummaryMapper } from '../mappers/StudentSummaryMapper.js';
import type { TypeOrmBalanceSnapshotReader } from '../../infrastructure/persistence/typeorm/TypeOrmBalanceSnapshotReader.js';
import type { ArchivePendingStudentCommand } from '../dto/ArchivePendingStudentCommand.js';

export class ArchivePendingStudentUseCase implements UseCase<ArchivePendingStudentCommand, StudentSummary> {
  constructor(
    private readonly students: StudentWriter,
    private readonly enrollments: EnrollmentWriter,
    private readonly balanceSnapshots: TypeOrmBalanceSnapshotReader,
  ) {}

  async execute(command: ArchivePendingStudentCommand): Promise<StudentSummary> {
    const studentId = StudentId.from(command.studentId);
    const student = await this.students.requireById(studentId);
    student.assertPendingArchive();

    const balanceSnapshot = await this.balanceSnapshots.loadForStudent(command.teacherId, command.studentId);
    const balanceAmount = parseAmountToBigInt(balanceSnapshot.balance);

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
