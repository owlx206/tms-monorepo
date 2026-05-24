import type { UseCase } from '../../../../shared/application/UseCase.js';
import { DomainError } from '../../../../shared/domain/DomainError.js';
import { Enrollment } from '../../domain/models/Enrollment.js';
import { StudentId } from '../../domain/value-objects/StudentId.js';
import type { StudentSummary } from '../../contracts/types.js';
import { StudentSummaryMapper } from '../mappers/StudentSummaryMapper.js';
import type { TypeOrmBalanceSnapshotReader } from '../../infrastructure/persistence/typeorm/Reader.js';
import type { TypeOrmClassroomAccess } from '../../infrastructure/persistence/typeorm/Reader.js';
import type { TypeOrmEnrollmentWriter, TypeOrmStudentWriter } from '../../infrastructure/persistence/typeorm/Writer.js';
import type { TransferStudentCommand } from '../../contracts/types.js';

export class TransferStudent implements UseCase<TransferStudentCommand, StudentSummary> {
  constructor(
    private readonly students: TypeOrmStudentWriter,
    private readonly enrollments: TypeOrmEnrollmentWriter,
    private readonly classroom: TypeOrmClassroomAccess,
    private readonly balanceSnapshots: TypeOrmBalanceSnapshotReader,
  ) {}

  async execute(command: TransferStudentCommand): Promise<StudentSummary> {
    const studentId = StudentId.from(command.studentId);
    const student = await this.students.requireById(studentId);
    student.assertActive();

    await this.classroom.ensureActiveClass(command.teacherId, command.toClassId);

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

    const balanceSnapshot = await this.balanceSnapshots.loadForStudent(command.teacherId, command.studentId);

    return StudentSummaryMapper.fromSnapshots({
      student: student.toSnapshot(),
      enrollment: savedNextEnrollment.toSnapshot(),
      balance: balanceSnapshot,
      fallbackStudentId: command.studentId,
    });
  }
}
