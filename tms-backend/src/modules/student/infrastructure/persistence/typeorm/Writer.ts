import { type DataSource, type EntityManager, IsNull } from 'typeorm';
import { Enrollment } from '../../../domain/models/Enrollment.js';
import { EnrollmentId } from '../../../domain/value-objects/EnrollmentId.js';
import { StudentId } from '../../../domain/value-objects/StudentId.js';
import { Enrollment as EnrollmentOrmEntity } from '../../../../../infrastructure/database/entities/enrollment.entity.js';
import { HttpError } from '../../../../../shared/errors/HttpError.js';
import { ArchivePendingStudent } from '../../../application/commands/ArchivePendingStudent.js';
import { CreateStudent } from '../../../application/commands/CreateStudent.js';
import { ReinstateStudent } from '../../../application/commands/ReinstateStudent.js';
import { TransferStudent } from '../../../application/commands/TransferStudent.js';
import { UpdateStudent } from '../../../application/commands/UpdateStudent.js';
import { WithdrawStudent } from '../../../application/commands/WithdrawStudent.js';
import { type ArchivePendingStudentCommand, type CreateStudentCommand, type ReinstateStudentCommand, type TransferStudentCommand, type UpdateStudentCommand, type WithdrawStudentCommand } from '../../../contracts/types.js';
import { findActiveEnrollment, findDiscordGuildByClass, findLastEnrollment, findRecentEnrollments, TypeOrmBalanceSnapshotReader, TypeOrmClassroomAccess } from './Reader.js';
import { type ClassDiscordBinding } from '../../../../../infrastructure/database/entities/discord/class-discord-binding.entity.js';
import {
  addDiscordGuildMember,
  fetchDiscordGuildMember,
  kickDiscordGuildMember,
} from '../../../../../infrastructure/external/discord/discord.js';
import type { SysadminDiscordBotCredentialStore } from '../../../../identity/infrastructure/persistence/typeorm/Writer.js';
import { type SysadminDiscordBotCredential } from '../../../../../infrastructure/database/entities/sysadmin-discord-bot-credential.entity.js';
import { refreshStudentDiscordToken } from '../../../../identity/infrastructure/auth/discord-oauth.js';
import { Student, Student as StudentOrmEntity } from '../../../../../infrastructure/database/entities/student.entity.js';
import { DomainError } from '../../../../../shared/domain/DomainError.js';
import { Student as DomainStudent, type Student as DomainStudentType } from '../../../domain/models/Student.js';
import { StudentDiscordCredential } from '../../../../../infrastructure/database/entities/student-discord-credential.entity.js';
import { EnrollmentPendingArchiveReason, EnrollmentStudentStatus, PendingArchiveReason, StudentStatus } from '../../../contracts/types.js';

type StudentWithDiscordCredential = StudentOrmEntity & {
  discord_username?: string | null;
  discord_user_id?: string | null;
};

export class EnrollmentMapper {
  toPersistence(enrollment: Enrollment, entity = new EnrollmentOrmEntity()): EnrollmentOrmEntity {
    const snapshot = enrollment.toSnapshot();

    if (snapshot.id !== null) {
      entity.id = snapshot.id;
    }

    entity.teacher_id = snapshot.teacherId;
    entity.student_id = snapshot.studentId;
    entity.class_id = snapshot.classId;
    entity.enrolled_at = snapshot.enrolledAt;
    entity.unenrolled_at = snapshot.unenrolledAt;

    return entity;
  }

  toDomain(entity: EnrollmentOrmEntity): Enrollment {
    return Enrollment.restore(
      {
        id: entity.id,
        teacherId: entity.teacher_id,
        studentId: entity.student_id,
        classId: entity.class_id,
        enrolledAt: entity.enrolled_at,
        unenrolledAt: entity.unenrolled_at,
      },
      EnrollmentId.from(entity.id),
    );
  }
}

export class StudentMapper {
  toDomain(entity: StudentWithDiscordCredential): DomainStudent {
    return DomainStudent.restore(
      {
        id: entity.id,
        teacherId: entity.teacher_id,
        fullName: entity.full_name,
        codeforcesHandle: entity.codeforces_handle,
        discordUsername: entity.discord_username ?? null,
        discordUserId: entity.discord_user_id ?? null,
        phone: entity.phone,
        note: entity.note,
        status: entity.status as unknown as EnrollmentStudentStatus,
        pendingArchiveReason: entity.pending_archive_reason as unknown as EnrollmentPendingArchiveReason | null,
        createdAt: entity.created_at,
        archivedAt: entity.archived_at,
      },
      StudentId.from(entity.id),
    );
  }

  toPersistence(student: DomainStudentType, entity = new StudentOrmEntity()): StudentOrmEntity {
    const snapshot = student.toSnapshot();

    if (snapshot.id !== null) {
      entity.id = snapshot.id;
    }

    entity.teacher_id = snapshot.teacherId;
    entity.full_name = snapshot.fullName;
    entity.codeforces_handle = snapshot.codeforcesHandle;
    entity.phone = snapshot.phone;
    entity.note = snapshot.note;
    entity.status = snapshot.status as unknown as StudentStatus;
    entity.pending_archive_reason = snapshot.pendingArchiveReason as unknown as PendingArchiveReason | null;
    entity.created_at = snapshot.createdAt ?? entity.created_at;
    entity.archived_at = snapshot.archivedAt;

    return entity;
  }
}

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
      const result = await this.withTransaction((context) => new CreateStudent(
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
      return new UpdateStudent(
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
      const result = await this.withTransaction((context) => this.createTransferStudent(context).execute(input));

      this.assertDiscordMembershipAdded(
        await this.studentDiscordMembershipNotifier.studentTransferred(input.teacherId, input.studentId, input.toClassId),
      );
      return result;
    },
  };

  readonly withdrawStudent = {
    execute: async (input: WithdrawStudentCommand) => {
      const result = await this.withTransaction((context) => this.createWithdrawStudent(context).execute(input));

      this.studentDiscordMembershipNotifier.studentWithdrawn(input.teacherId, input.studentId);
      return result;
    },
  };

  readonly reinstateStudent = {
    execute: async (input: ReinstateStudentCommand) => {
      const result = await this.withTransaction((context) => new ReinstateStudent(
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
      return new ArchivePendingStudent(
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

  private createTransferStudent(context: StudentPersistenceContext): TransferStudent {
    return new TransferStudent(
      context.students,
      context.enrollments,
      context.classroom,
      context.balanceSnapshots,
    );
  }

  private createWithdrawStudent(context: StudentPersistenceContext): WithdrawStudent {
    return new WithdrawStudent(
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
    const discordCredential = student
      ? await this.dataSource.manager.getRepository(StudentDiscordCredential).findOneBy({ student_id: student.id })
      : null;
    if (!student || !discordCredential?.discord_user_id?.trim()) {
      return { sent: false, reason: 'student must authorize Discord before being added to class guild' };
    }

    const credential = await this.getSystemBotCredential();
    if (!credential) {
      return { sent: false, reason: 'discord is not available right now' };
    }

    const accessToken = await this.getValidStudentAccessToken(student, discordCredential, credential);
    if (!accessToken) {
      return { sent: false, reason: 'student must authorize Discord again' };
    }

    const server = await findDiscordGuildByClass(this.dataSource.manager, teacherId, classId);
    if (!server) {
      return { sent: false, reason: 'class Discord guild is not configured' };
    }

    return this.addStudentToClassGuild({
      student,
      discordCredential,
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
    const discordCredential = student
      ? await this.dataSource.manager.getRepository(StudentDiscordCredential).findOneBy({ student_id: student.id })
      : null;
    if (!discordCredential?.discord_user_id?.trim()) {
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
      server,
      userId: discordCredential.discord_user_id,
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
    const discordCredential = student
      ? await this.dataSource.manager.getRepository(StudentDiscordCredential).findOneBy({ student_id: student.id })
      : null;
    if (!student || !discordCredential?.discord_user_id?.trim()) {
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
          server: oldServer,
          userId: discordCredential.discord_user_id,
          token: credential.bot_token,
        });
      }
    }

    const newServer = await findDiscordGuildByClass(this.dataSource.manager, teacherId, newClassId);
    if (!newServer) {
      return { sent: false, reason: 'class Discord guild is not configured' };
    }

    const accessToken = await this.getValidStudentAccessToken(student, discordCredential, credential);
    if (!accessToken) {
      return { sent: false, reason: 'student must authorize Discord again' };
    }

    return this.addStudentToClassGuild({
      student,
      discordCredential,
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

  private async kickFromServer(input: {
    server: ClassDiscordBinding;
    userId: string;
    token: string;
  }): Promise<void> {
    try {
      await kickDiscordGuildMember({
        botToken: input.token,
        guildId: input.server.discord_guild_id,
        userId: input.userId,
      });
    } catch {
    }
  }

  private async addStudentToClassGuild(input: {
    student: Student;
    discordCredential: StudentDiscordCredential;
    userAccessToken: string;
    targetServer: ClassDiscordBinding;
    token: string;
  }): Promise<StudentDiscordInviteResult> {
    try {
      const existingMember = await fetchDiscordGuildMember({
        botToken: input.token,
        guildId: input.targetServer.discord_guild_id,
        userId: input.discordCredential.discord_user_id ?? '',
      });
      if (existingMember) {
        return { sent: true, reason: null };
      }

      await addDiscordGuildMember({
        botToken: input.token,
        guildId: input.targetServer.discord_guild_id,
        userId: input.discordCredential.discord_user_id ?? '',
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
    discordCredential: StudentDiscordCredential,
    credential: SysadminDiscordBotCredential,
  ): Promise<string | null> {
    if (!discordCredential.discord_access_token || !discordCredential.discord_refresh_token || !discordCredential.discord_token_expires_at) {
      return null;
    }

    if (discordCredential.discord_token_expires_at.getTime() > Date.now() + 60_000) {
      return discordCredential.discord_access_token;
    }

    if (!credential.client_id || !credential.client_secret) {
      return null;
    }

    try {
      const refreshed = await refreshStudentDiscordToken({
        refreshToken: discordCredential.discord_refresh_token,
        clientId: credential.client_id,
        clientSecret: credential.client_secret,
      });
      await this.dataSource.manager.getRepository(StudentDiscordCredential).update(
        { student_id: student.id },
        {
          discord_access_token: refreshed.accessToken,
          discord_refresh_token: refreshed.refreshToken,
          discord_token_expires_at: refreshed.expiresAt,
        },
      );
      discordCredential.discord_access_token = refreshed.accessToken;
      discordCredential.discord_refresh_token = refreshed.refreshToken;
      discordCredential.discord_token_expires_at = refreshed.expiresAt;
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
