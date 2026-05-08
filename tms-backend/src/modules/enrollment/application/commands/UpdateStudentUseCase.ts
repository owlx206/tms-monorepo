import type { UseCase } from '../../../../shared/application/UseCase.js';
import { DomainError } from '../../../../shared/domain/DomainError.js';
import type { EnrollmentRepository } from '../../domain/repositories/EnrollmentRepository.js';
import type { StudentRepository } from '../../domain/repositories/StudentRepository.js';
import { CodeforcesHandle } from '../../domain/value-objects/CodeforcesHandle.js';
import { StudentId } from '../../domain/value-objects/StudentId.js';
import type { StudentSummary } from '../dto/StudentDto.js';
import { StudentSummaryMapper } from '../mappers/StudentSummaryMapper.js';
import type { BalanceSnapshotPort } from '../ports/BalanceSnapshotPort.js';
import type { UpdateStudentCommand } from '../dto/UpdateStudentCommand.js';

export class UpdateStudentUseCase implements UseCase<UpdateStudentCommand, StudentSummary> {
  constructor(
    private readonly students: StudentRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly balanceSnapshots: BalanceSnapshotPort,
  ) {}

  async execute(command: UpdateStudentCommand): Promise<StudentSummary> {
    const studentId = StudentId.from(command.studentId);
    const student = await this.students.requireById(studentId);

    if (command.fullName !== undefined) {
      student.rename(command.fullName);
    }

    if (command.codeforcesHandle !== undefined) {
      const codeforcesHandle = CodeforcesHandle.fromNullable(command.codeforcesHandle);
      if (
        codeforcesHandle
        && await this.students.codeforcesHandleExists(command.teacherId, codeforcesHandle.value, command.studentId)
      ) {
        throw new DomainError('codeforces_handle_already_exists', 'codeforces_handle already exists');
      }

      student.updateCodeforcesHandle(codeforcesHandle);
    }

    if (command.discordUsername !== undefined) {
      student.updateDiscordUsername(command.discordUsername);
    }

    if (command.discordUserId !== undefined) {
      student.updateDiscordUserId(command.discordUserId);
    }

    if (command.phone !== undefined) {
      student.updatePhone(command.phone);
    }

    if (command.note !== undefined) {
      student.updateNote(command.note);
    }

    const savedStudent = await this.students.save(student);
    const activeEnrollment = await this.enrollments.findActiveByStudent(command.teacherId, studentId);
    const balanceSnapshot = await this.balanceSnapshots.loadForStudent(command.teacherId, command.studentId);

    return StudentSummaryMapper.fromSnapshots({
      student: savedStudent.toSnapshot(),
      enrollment: activeEnrollment?.toSnapshot() ?? null,
      balance: balanceSnapshot,
      fallbackStudentId: command.studentId,
    });
  }
}
