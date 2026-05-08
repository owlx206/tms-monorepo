import type { UseCase } from '../../../../shared/application/UseCase.js';
import { DomainError } from '../../../../shared/domain/DomainError.js';
import { Enrollment } from '../../domain/models/Enrollment.js';
import type { EnrollmentRepository } from '../../domain/repositories/EnrollmentRepository.js';
import type { StudentRepository } from '../../domain/repositories/StudentRepository.js';
import { StudentId } from '../../domain/value-objects/StudentId.js';
import type { StudentSummary } from '../dto/StudentDto.js';
import { StudentSummaryMapper } from '../mappers/StudentSummaryMapper.js';
import type { BalanceSnapshotPort } from '../ports/BalanceSnapshotPort.js';
import type { ClassroomPort } from '../ports/ClassroomPort.js';
import type { TransferStudentCommand } from '../dto/TransferStudentCommand.js';

export class TransferStudentUseCase implements UseCase<TransferStudentCommand, StudentSummary> {
  constructor(
    private readonly students: StudentRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly classroom: ClassroomPort,
    private readonly balanceSnapshots: BalanceSnapshotPort,
  ) {}

  async execute(command: TransferStudentCommand): Promise<StudentSummary> {
    const studentId = StudentId.from(command.studentId);
    const student = await this.students.requireById(studentId);
    student.assertActive();

    await this.classroom.ensureActiveClass(command.toClassId);

    const activeEnrollment = await this.enrollments.findActiveByStudent(command.teacherId, studentId);
    if (!activeEnrollment) {
      throw new DomainError('student_has_no_active_enrollment', 'student has no active enrollment');
    }

    activeEnrollment.assertTransferableTo(command.toClassId, command.transferredAt);
    activeEnrollment.endAt(command.transferredAt);
    await this.enrollments.save(activeEnrollment);

    const nextEnrollment = Enrollment.create({
      teacherId: command.teacherId,
      studentId,
      classId: command.toClassId,
      enrolledAt: command.transferredAt,
    });
    const savedNextEnrollment = await this.enrollments.save(nextEnrollment);
    student.recordTransferred(command.toClassId, command.transferredAt);

    const balanceSnapshot = await this.balanceSnapshots.loadForStudent(command.teacherId, command.studentId);

    return StudentSummaryMapper.fromSnapshots({
      student: student.toSnapshot(),
      enrollment: savedNextEnrollment.toSnapshot(),
      balance: balanceSnapshot,
      fallbackStudentId: command.studentId,
    });
  }
}
