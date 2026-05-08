import type { DataSource, EntityManager } from 'typeorm';

import { ArchivePendingStudentUseCase } from '../../../application/commands/ArchivePendingStudentUseCase.js';
import { BulkTransferStudentsUseCase } from '../../../application/commands/BulkTransferStudentsUseCase.js';
import { BulkWithdrawStudentsUseCase } from '../../../application/commands/BulkWithdrawStudentsUseCase.js';
import { CreateStudentUseCase } from '../../../application/commands/CreateStudentUseCase.js';
import { ReinstateStudentUseCase } from '../../../application/commands/ReinstateStudentUseCase.js';
import { TransferStudentUseCase } from '../../../application/commands/TransferStudentUseCase.js';
import { UpdateStudentUseCase } from '../../../application/commands/UpdateStudentUseCase.js';
import { WithdrawStudentUseCase } from '../../../application/commands/WithdrawStudentUseCase.js';
import type { ArchivePendingStudentCommand } from '../../../application/dto/ArchivePendingStudentCommand.js';
import type { BulkTransferStudentsCommand } from '../../../application/dto/BulkTransferStudentsCommand.js';
import type { BulkWithdrawStudentsCommand } from '../../../application/dto/BulkWithdrawStudentsCommand.js';
import type { CreateStudentCommand } from '../../../application/dto/CreateStudentCommand.js';
import type { ReinstateStudentCommand } from '../../../application/dto/ReinstateStudentCommand.js';
import type { TransferStudentCommand } from '../../../application/dto/TransferStudentCommand.js';
import type { UpdateStudentCommand } from '../../../application/dto/UpdateStudentCommand.js';
import type { WithdrawStudentCommand } from '../../../application/dto/WithdrawStudentCommand.js';
import { TypeOrmArchiveFinancePort } from './TypeOrmArchiveFinancePort.js';
import { TypeOrmBalanceSnapshotPort } from './TypeOrmBalanceSnapshotPort.js';
import { TypeOrmClassroomPort } from './TypeOrmClassroomPort.js';
import { TypeOrmEnrollmentRepository } from './TypeOrmEnrollmentRepository.js';
import { TypeOrmStudentRepository } from './TypeOrmStudentRepository.js';
import type { StudentCommunityPort } from '../../../application/ports/StudentCommunityPort.js';
import { StudentCommunityNotifier } from './StudentCommunityNotifier.js';

type StudentPersistenceContext = {
  students: TypeOrmStudentRepository;
  enrollments: TypeOrmEnrollmentRepository;
  classroom: TypeOrmClassroomPort;
  balanceSnapshots: TypeOrmBalanceSnapshotPort;
  archiveFinance: TypeOrmArchiveFinancePort;
};

export class TypeOrmStudentCommandHandlers {
  private readonly studentCommunityNotifier: StudentCommunityNotifier;

  constructor(
    private readonly dataSource: DataSource,
    studentCommunityPort?: StudentCommunityPort,
  ) {
    this.studentCommunityNotifier = new StudentCommunityNotifier(studentCommunityPort);
  }

  readonly createStudent = {
    execute: async (input: CreateStudentCommand) => {
      const result = await this.withTransaction((context) => new CreateStudentUseCase(
        context.students,
        context.enrollments,
        context.classroom,
      ).execute(input));

      this.studentCommunityNotifier.studentEnrolled(input.teacherId, result.id, input.classId);
      return result;
    },
  };

  readonly updateStudent = {
    execute: (input: UpdateStudentCommand) => this.withTransaction((context) => {
      return new UpdateStudentUseCase(
        context.students,
        context.enrollments,
        context.balanceSnapshots,
      ).execute(input);
    }),
  };

  readonly inviteStudentToCurrentClass = {
    execute: async (input: { teacherId: number; studentId: number }) => {
      return this.studentCommunityNotifier.inviteStudentToCurrentClass(input);
    },
  };

  readonly transferStudent = {
    execute: async (input: TransferStudentCommand) => {
      const result = await this.withTransaction((context) => this.createTransferStudentUseCase(context).execute(input));

      this.studentCommunityNotifier.studentTransferred(input.teacherId, input.studentId, input.toClassId);
      return result;
    },
  };

  readonly bulkTransferStudents = {
    execute: async (input: BulkTransferStudentsCommand) => {
      const result = await this.withTransaction((context) => {
        const transferStudent = this.createTransferStudentUseCase(context);
        return new BulkTransferStudentsUseCase(transferStudent).execute(input);
      });

      result.forEach((student) => {
        this.studentCommunityNotifier.studentTransferred(input.teacherId, student.id, input.toClassId);
      });

      return result;
    },
  };

  readonly withdrawStudent = {
    execute: async (input: WithdrawStudentCommand) => {
      const result = await this.withTransaction((context) => this.createWithdrawStudentUseCase(context).execute(input));

      this.studentCommunityNotifier.studentWithdrawn(input.teacherId, input.studentId);
      return result;
    },
  };

  readonly bulkWithdrawStudents = {
    execute: async (input: BulkWithdrawStudentsCommand) => {
      const result = await this.withTransaction((context) => {
        const withdrawStudent = this.createWithdrawStudentUseCase(context);
        return new BulkWithdrawStudentsUseCase(withdrawStudent).execute(input);
      });

      result.forEach((student) => {
        this.studentCommunityNotifier.studentWithdrawn(input.teacherId, student.id);
      });

      return result;
    },
  };

  readonly reinstateStudent = {
    execute: async (input: ReinstateStudentCommand) => {
      const result = await this.withTransaction((context) => new ReinstateStudentUseCase(
        context.students,
        context.enrollments,
        context.classroom,
        context.balanceSnapshots,
      ).execute(input));

      this.studentCommunityNotifier.studentEnrolled(input.teacherId, input.studentId, input.classId);
      return result;
    },
  };

  readonly archivePendingStudent = {
    execute: (input: ArchivePendingStudentCommand) => this.withTransaction((context) => {
      return new ArchivePendingStudentUseCase(
        context.students,
        context.enrollments,
        context.balanceSnapshots,
        context.archiveFinance,
      ).execute(input);
    }),
  };

  private withTransaction<T>(work: (context: StudentPersistenceContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) => work(this.createPersistenceContext(manager)));
  }

  private createPersistenceContext(manager: EntityManager): StudentPersistenceContext {
    return {
      students: new TypeOrmStudentRepository(manager),
      enrollments: new TypeOrmEnrollmentRepository(manager),
      classroom: new TypeOrmClassroomPort(manager),
      balanceSnapshots: new TypeOrmBalanceSnapshotPort(manager),
      archiveFinance: new TypeOrmArchiveFinancePort(manager),
    };
  }

  private createTransferStudentUseCase(context: StudentPersistenceContext): TransferStudentUseCase {
    return new TransferStudentUseCase(
      context.students,
      context.enrollments,
      context.classroom,
      context.balanceSnapshots,
    );
  }

  private createWithdrawStudentUseCase(context: StudentPersistenceContext): WithdrawStudentUseCase {
    return new WithdrawStudentUseCase(
      context.students,
      context.enrollments,
      context.balanceSnapshots,
    );
  }
}
