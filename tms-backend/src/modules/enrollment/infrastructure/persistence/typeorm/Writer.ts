import { type DataSource, type EntityManager, IsNull } from 'typeorm';
import { type Enrollment } from '../../../domain/models/Enrollment.js';
import { StudentId } from '../../../domain/value-objects/StudentId.js';
import { EnrollmentMapper, StudentMapper } from './Mapper.js';
import { Enrollment as EnrollmentOrmEntity } from './entities/enrollment.entity.js';
import { HttpError } from '../../../../../shared/errors/HttpError.js';
import { ArchivePendingStudentUseCase } from '../../../application/commands/ArchivePendingStudentUseCase.js';
import { CreateStudentUseCase } from '../../../application/commands/CreateStudentUseCase.js';
import { ReinstateStudentUseCase } from '../../../application/commands/ReinstateStudentUseCase.js';
import { TransferStudentUseCase } from '../../../application/commands/TransferStudentUseCase.js';
import { UpdateStudentUseCase } from '../../../application/commands/UpdateStudentUseCase.js';
import { WithdrawStudentUseCase } from '../../../application/commands/WithdrawStudentUseCase.js';
import { type ArchivePendingStudentCommand, type CreateStudentCommand, type ReinstateStudentCommand, type TransferStudentCommand, type UpdateStudentCommand, type WithdrawStudentCommand } from '../../../contracts/types.js';
import { findActiveEnrollment, findDiscordGuildByClass, findLastEnrollment, findRecentEnrollments, TypeOrmBalanceSnapshotReader, TypeOrmClassroomAccess } from './Reader.js';
import { type ClassDiscordBinding } from '../../../../messaging/infrastructure/persistence/typeorm/entities/class-discord-binding.entity.js';
import { DiscordClient } from '../../../../../infrastructure/external/discord/discord-api.service.js';
import type { SysadminDiscordBotCredentialStore } from '../../../../identity/infrastructure/persistence/typeorm/Writer.js';
import { type SysadminDiscordBotCredential } from '../../../../identity/infrastructure/persistence/typeorm/entities/sysadmin-discord-bot-credential.entity.js';
import { refreshStudentDiscordToken } from '../../../../identity/infrastructure/discord/DiscordStudentOAuth.js';
import { Student, Student as StudentOrmEntity } from './entities/student.entity.js';
import { DomainError } from '../../../../../shared/domain/DomainError.js';
import { type Student as DomainStudent } from '../../../domain/models/Student.js';

// StudentDiscordMembershipNotifier.ts
const discordAutomationNotConfigured: StudentDiscordInviteResult = {
  sent: false,
  reason: 'Discord automation is not configured',
};

export class StudentDiscordMembershipNotifier {
  constructor(private readonly studentDiscordMembershipService?: TypeOrmStudentDiscordMembershipService) {}

  inviteStudentToCurrentClass(input: {
    teacherId: number;
    studentId: number;
  }): Promise<StudentDiscordInviteResult> {
    return this.studentDiscordMembershipService?.inviteStudentToCurrentClass(
      input.teacherId,
      input.studentId,
    ) ?? Promise.resolve(discordAutomationNotConfigured);
  }

  studentEnrolled(
    teacherId: number,
    studentId: number,
    classId: number,
  ): Promise<StudentDiscordInviteResult> {
    return this.studentDiscordMembershipService?.onStudentEnrolled(
      teacherId,
      studentId,
      classId,
    ) ?? Promise.resolve(discordAutomationNotConfigured);
  }

  studentTransferred(
    teacherId: number,
    studentId: number,
    toClassId: number,
  ): Promise<StudentDiscordInviteResult> {
    return this.studentDiscordMembershipService?.onStudentTransferred(
      teacherId,
      studentId,
      toClassId,
    ) ?? Promise.resolve(discordAutomationNotConfigured);
  }

  studentWithdrawn(teacherId: number, studentId: number): void {
    void this.studentDiscordMembershipService?.onStudentWithdrawn(teacherId, studentId).catch(() => {});
  }
}

// TypeOrmEnrollmentWriter.ts
export class TypeOrmEnrollmentWriter {
  constructor(
    private readonly manager: EntityManager,
    private readonly mapper = new EnrollmentMapper(),
  ) {}

  async findActiveByStudent(teacherId: number, studentId: StudentId): Promise<Enrollment | null> {
    const entity = await this.manager.getRepository(EnrollmentOrmEntity).findOne({
      where: {
        teacher_id: teacherId,
        student_id: studentId.value,
        unenrolled_at: IsNull(),
      },
    });

    return entity ? this.mapper.toDomain(entity) : null;
  }

  async save(enrollment: Enrollment): Promise<Enrollment> {
    const entity = this.mapper.toPersistence(enrollment);
    const saved = await this.manager.getRepository(EnrollmentOrmEntity).save(entity);

    return this.mapper.toDomain(saved);
  }
}

// TypeOrmStudentCommandHandlers.ts
type StudentPersistenceContext = {
  students: TypeOrmStudentWriter;
  enrollments: TypeOrmEnrollmentWriter;
  classroom: TypeOrmClassroomAccess;
  balanceSnapshots: TypeOrmBalanceSnapshotReader;
};

export class TypeOrmStudentCommandHandlers {
  private readonly studentDiscordMembershipNotifier: StudentDiscordMembershipNotifier;

  constructor(
    private readonly dataSource: DataSource,
    studentDiscordMembershipService?: TypeOrmStudentDiscordMembershipService,
  ) {
    this.studentDiscordMembershipNotifier = new StudentDiscordMembershipNotifier(studentDiscordMembershipService);
  }

  readonly createStudent = {
    execute: async (input: CreateStudentCommand) => {
      const result = await this.withTransaction((context) => new CreateStudentUseCase(
        context.students,
        context.enrollments,
        context.classroom,
      ).execute(input));

      void this.studentDiscordMembershipNotifier.studentEnrolled(input.teacherId, result.id, input.classId).catch(() => {});
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
      return this.studentDiscordMembershipNotifier.inviteStudentToCurrentClass(input);
    },
  };

  readonly transferStudent = {
    execute: async (input: TransferStudentCommand) => {
      const result = await this.withTransaction((context) => this.createTransferStudentUseCase(context).execute(input));

      this.assertDiscordMembershipAdded(
        await this.studentDiscordMembershipNotifier.studentTransferred(input.teacherId, input.studentId, input.toClassId),
      );
      return result;
    },
  };

  readonly withdrawStudent = {
    execute: async (input: WithdrawStudentCommand) => {
      const result = await this.withTransaction((context) => this.createWithdrawStudentUseCase(context).execute(input));

      this.studentDiscordMembershipNotifier.studentWithdrawn(input.teacherId, input.studentId);
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

      void this.studentDiscordMembershipNotifier.studentEnrolled(input.teacherId, input.studentId, input.classId)
        .catch(() => {});
      return result;
    },
  };

  readonly archivePendingStudent = {
    execute: (input: ArchivePendingStudentCommand) => this.withTransaction((context) => {
      return new ArchivePendingStudentUseCase(
        context.students,
        context.enrollments,
        context.balanceSnapshots,
      ).execute(input);
    }),
  };

  private withTransaction<T>(work: (context: StudentPersistenceContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) => work(this.createPersistenceContext(manager)));
  }

  private createPersistenceContext(manager: EntityManager): StudentPersistenceContext {
    return {
      students: new TypeOrmStudentWriter(manager),
      enrollments: new TypeOrmEnrollmentWriter(manager),
      classroom: new TypeOrmClassroomAccess(manager),
      balanceSnapshots: new TypeOrmBalanceSnapshotReader(manager),
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

  private assertDiscordMembershipAdded(result: StudentDiscordInviteResult): void {
    if (result.sent) {
      return;
    }

    throw new HttpError(
      result.reason ? `discord_membership_add_failed: ${result.reason}` : 'discord_membership_add_failed',
      502,
    );
  }
}

// TypeOrmStudentDiscordMembershipService.ts
export type StudentDiscordInviteResult = {
  sent: boolean;
  reason: string | null;
};

export class TypeOrmStudentDiscordMembershipService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore,
  ) {}

  async onStudentEnrolled(
    teacherId: number,
    studentId: number,
    classId: number,
  ): Promise<StudentDiscordInviteResult> {
    return this.inviteStudentToClass(teacherId, studentId, classId);
  }

  async inviteStudentToCurrentClass(
    teacherId: number,
    studentId: number,
  ): Promise<StudentDiscordInviteResult> {
    const activeEnrollment = await findActiveEnrollment(this.dataSource.manager, teacherId, studentId);
    if (!activeEnrollment) {
      return { sent: false, reason: 'student has no active class enrollment' };
    }

    return this.inviteStudentToClass(teacherId, studentId, activeEnrollment.class_id);
  }

  private async inviteStudentToClass(
    teacherId: number,
    studentId: number,
    classId: number,
  ): Promise<StudentDiscordInviteResult> {
    const student = await this.dataSource.manager.getRepository(Student).findOneBy({
      teacher_id: teacherId,
      id: studentId,
    });
    if (!student?.discord_user_id?.trim()) {
      return { sent: false, reason: 'student must authorize Discord before being added to class guild' };
    }

    const credential = await this.getSystemBotCredential();
    if (!credential) {
      return { sent: false, reason: 'discord is not available right now' };
    }

    const accessToken = await this.getValidStudentAccessToken(student, credential);
    if (!accessToken) {
      return { sent: false, reason: 'student must authorize Discord again' };
    }

    const server = await findDiscordGuildByClass(this.dataSource.manager, teacherId, classId);
    if (!server) {
      return { sent: false, reason: 'class Discord guild is not configured' };
    }

    return this.addStudentToClassGuild({
      student,
      userAccessToken: accessToken,
      targetServer: server,
      token: credential.bot_token,
    });
  }

  async onStudentWithdrawn(teacherId: number, studentId: number): Promise<void> {
    const student = await this.dataSource.manager.getRepository(Student).findOneBy({
      teacher_id: teacherId,
      id: studentId,
    });
    if (!student?.discord_user_id?.trim()) {
      return;
    }

    const credential = await this.getSystemBotCredential();
    if (!credential) {
      return;
    }

    const lastEnrollment = await findLastEnrollment(this.dataSource.manager, teacherId, studentId);
    if (!lastEnrollment) {
      return;
    }

    const server = await findDiscordGuildByClass(this.dataSource.manager, teacherId, lastEnrollment.class_id);
    if (!server) {
      return;
    }

    await this.kickFromServer({
      server: this.withSystemBotToken(server, credential.bot_token),
      userId: student.discord_user_id,
      token: credential.bot_token,
    });
  }

  async onStudentTransferred(
    teacherId: number,
    studentId: number,
    newClassId: number,
  ): Promise<StudentDiscordInviteResult> {
    const student = await this.dataSource.manager.getRepository(Student).findOneBy({
      teacher_id: teacherId,
      id: studentId,
    });
    if (!student?.discord_user_id?.trim()) {
      return { sent: false, reason: 'student must authorize Discord before being added to class guild' };
    }

    const credential = await this.getSystemBotCredential();
    if (!credential) {
      return { sent: false, reason: 'discord is not available right now' };
    }

    const enrollments = await findRecentEnrollments(this.dataSource.manager, teacherId, studentId, 2);
    const oldEnrollment = enrollments.length >= 2 ? enrollments[1] : null;

    if (oldEnrollment) {
      const oldServer = await findDiscordGuildByClass(this.dataSource.manager, teacherId, oldEnrollment.class_id);
      if (oldServer) {
        await this.kickFromServer({
          server: this.withSystemBotToken(oldServer, credential.bot_token),
          userId: student.discord_user_id,
          token: credential.bot_token,
        });
      }
    }

    const newServer = await findDiscordGuildByClass(this.dataSource.manager, teacherId, newClassId);
    if (!newServer) {
      return { sent: false, reason: 'class Discord guild is not configured' };
    }

    const accessToken = await this.getValidStudentAccessToken(student, credential);
    if (!accessToken) {
      return { sent: false, reason: 'student must authorize Discord again' };
    }

    return this.addStudentToClassGuild({
      student,
      userAccessToken: accessToken,
      targetServer: newServer,
      token: credential.bot_token,
    });
  }

  private async getSystemBotCredential(): Promise<SysadminDiscordBotCredential | null> {
    const credential = await this.discordBotCredentialStore.findDefault();
    const token = credential?.bot_token?.trim();
    return credential && token && token.length > 0 ? credential : null;
  }

  private withSystemBotToken(server: ClassDiscordBinding, token: string): ClassDiscordBinding {
    return {
      ...server,
      bot_token: token,
    };
  }

  private async kickFromServer(input: {
    server: ClassDiscordBinding;
    userId: string;
    token: string;
  }): Promise<void> {
    try {
      await new DiscordClient(input.token).kickGuildMember({
        guildId: input.server.discord_guild_id,
        userId: input.userId,
      });
    } catch {
    }
  }

  private async addStudentToClassGuild(input: {
    student: Student;
    userAccessToken: string;
    targetServer: ClassDiscordBinding;
    token: string;
  }): Promise<StudentDiscordInviteResult> {
    try {
      const discord = new DiscordClient(input.token);
      const existingMember = await discord.fetchGuildMember({
        guildId: input.targetServer.discord_guild_id,
        userId: input.student.discord_user_id ?? '',
      });
      if (existingMember) {
        return { sent: true, reason: null };
      }

      await discord.addGuildMember({
        guildId: input.targetServer.discord_guild_id,
        userId: input.student.discord_user_id ?? '',
        userAccessToken: input.userAccessToken,
      });
      return { sent: true, reason: null };
    } catch (error) {
      return {
        sent: false,
        reason: error instanceof Error && error.message.trim()
          ? error.message
          : 'failed to add student to Discord class guild',
      };
    }
  }

  private async getValidStudentAccessToken(
    student: Student,
    credential: SysadminDiscordBotCredential,
  ): Promise<string | null> {
    if (!student.discord_access_token || !student.discord_refresh_token || !student.discord_token_expires_at) {
      return null;
    }

    if (student.discord_token_expires_at.getTime() > Date.now() + 60_000) {
      return student.discord_access_token;
    }

    if (!credential.client_id || !credential.client_secret) {
      return null;
    }

    try {
      const refreshed = await refreshStudentDiscordToken({
        refreshToken: student.discord_refresh_token,
        clientId: credential.client_id,
        clientSecret: credential.client_secret,
      });
      await this.dataSource.manager.getRepository(Student).update(
        { teacher_id: student.teacher_id, id: student.id },
        {
          discord_access_token: refreshed.accessToken,
          discord_refresh_token: refreshed.refreshToken,
          discord_token_expires_at: refreshed.expiresAt,
        },
      );
      student.discord_access_token = refreshed.accessToken;
      student.discord_refresh_token = refreshed.refreshToken;
      student.discord_token_expires_at = refreshed.expiresAt;
      return refreshed.accessToken;
    } catch {
      return null;
    }
  }
}

// TypeOrmStudentWriter.ts
export class TypeOrmStudentWriter {
  constructor(
    private readonly manager: EntityManager,
    private readonly mapper = new StudentMapper(),
  ) {}

  async codeforcesHandleExists(
    teacherId: number,
    codeforcesHandle: string,
    excludeStudentId?: number,
  ): Promise<boolean> {
    const queryBuilder = this.manager
      .getRepository(StudentOrmEntity)
      .createQueryBuilder('student')
      .where('student.teacher_id = :teacherId', { teacherId })
      .andWhere('student.codeforces_handle IS NOT NULL')
      .andWhere('LOWER(student.codeforces_handle) = LOWER(:handle)', {
        handle: codeforcesHandle,
      });

    if (excludeStudentId !== undefined) {
      queryBuilder.andWhere('student.id <> :excludeStudentId', { excludeStudentId });
    }

    return queryBuilder.getExists();
  }

  async requireById(id: StudentId): Promise<DomainStudent> {
    const entity = await this.manager.getRepository(StudentOrmEntity).findOneBy({ id: id.value });

    if (!entity) {
      throw new DomainError('student_not_found', 'student not found');
    }

    return this.mapper.toDomain(entity);
  }

  async save(student: DomainStudent): Promise<DomainStudent> {
    const entity = this.mapper.toPersistence(student);
    const saved = await this.manager.getRepository(StudentOrmEntity).save(entity);

    return this.mapper.toDomain(saved);
  }
}
