import { EntityManager, In, IsNull } from 'typeorm';
import { ClassDiscordBinding } from '../../../../../infrastructure/database/entities/discord/class-discord-binding.entity.js';
import { FeeRecord } from '../../../../../infrastructure/database/entities/fee-record.entity.js';
import { FeeRecordStatus } from '../../../../finance/contracts/types.js';
import { Transaction } from '../../../../../infrastructure/database/entities/transaction.entity.js';
import { parseAmountToBigInt } from '../../../../finance/domain/Money.js';
import { EnrollmentPendingArchiveReason, EnrollmentStudentStatus, type StudentBalanceSnapshot, type StudentEnrollmentSummary, type StudentListFilters, StudentStatus, type StudentSummary } from '../../../contracts/types.js';
import { Enrollment } from '../../../../../infrastructure/database/entities/enrollment.entity.js';
import { Student } from '../../../../../infrastructure/database/entities/student.entity.js';
import { Class } from '../../../../../infrastructure/database/entities/class.entity.js';
import { ClassSchedule } from '../../../../../infrastructure/database/entities/class-schedule.entity.js';
import { ClassStatus } from '../../../../classroom/contracts/types.js';
import { HttpError } from '../../../../../shared/errors/HttpError.js';
import { TypeOrmTransactionReader } from '../../../../finance/infrastructure/persistence/typeorm/Reader.js';
import { DomainError } from '../../../../../shared/domain/DomainError.js';
import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { GymProblem } from '../../../../../infrastructure/database/entities/gym/gym-problem.entity.js';
import { GymStanding } from '../../../../../infrastructure/database/entities/gym/gym-standing.entity.js';
import { Gym } from '../../../../../infrastructure/database/entities/gym/gym.entity.js';
import { StudentDiscordCredential } from '../../../../../infrastructure/database/entities/student-discord-credential.entity.js';

type StudentWithDiscordCredential = Student & {
  discord_username?: string | null;
  discord_user_id?: string | null;
};

export function toStudentSummary(
  student: StudentWithDiscordCredential,
  context: {
    current_class_id: number | null;
    current_enrollment_id: number | null;
    balance_snapshot: StudentBalanceSnapshot;
  },
): StudentSummary {
  return {
    id: student.id,
    teacher_id: student.teacher_id,
    full_name: student.full_name,
    codeforces_handle: student.codeforces_handle,
    discord_username: student.discord_username ?? null,
    discord_user_id: student.discord_user_id ?? null,
    phone: student.phone,
    note: student.note,
    status: student.status as unknown as EnrollmentStudentStatus,
    pending_archive_reason: student.pending_archive_reason as unknown as EnrollmentPendingArchiveReason | null,
    created_at: student.created_at,
    archived_at: student.archived_at,
    current_class_id: context.current_class_id,
    current_enrollment_id: context.current_enrollment_id,
    transactions_total: context.balance_snapshot.transactions_total,
    active_fee_total: context.balance_snapshot.active_fee_total,
    balance: context.balance_snapshot.balance,
  };
}

// EnrollmentDataAccess.ts
export function createZeroBalanceSnapshot(): StudentBalanceSnapshot {
  return {
    transactions_total: '0',
    active_fee_total: '0',
    balance: '0',
  };
}

export async function listStudentIdsByClassAtTime(input: {
  teacherId: number;
  classId: number;
  at: Date;
}): Promise<number[]> {
  const rows = await AppDataSource.getRepository(Student)
    .createQueryBuilder('student')
    .innerJoin(
      Enrollment,
      'enrollment',
      `
        enrollment.teacher_id = student.teacher_id
        AND enrollment.student_id = student.id
        AND enrollment.class_id = :classId
        AND enrollment.enrolled_at <= :at
        AND (enrollment.unenrolled_at IS NULL OR enrollment.unenrolled_at > :at)
      `,
      { classId: input.classId, at: input.at },
    )
    .select('student.id', 'student_id')
    .where('student.teacher_id = :teacherId', { teacherId: input.teacherId })
    .getRawMany<{ student_id: number | string }>();

  return rows.map((row) => Number(row.student_id));
}

export type StudentMessageRecipientBase = {
  student_id: number;
  student_name: string;
  active_class_id: number | null;
};

function toStudentMessageRecipientBase(row: {
  student_id: number | string;
  student_name: string;
  active_class_id: number | string | null;
}): StudentMessageRecipientBase {
  return {
    student_id: Number(row.student_id),
    student_name: row.student_name,
    active_class_id: row.active_class_id === null ? null : Number(row.active_class_id),
  };
}

function studentMessageRecipientBaseQuery(teacherId: number) {
  return AppDataSource.getRepository(Student)
    .createQueryBuilder('student')
    .leftJoin(
      Enrollment,
      'active_enrollment',
      'active_enrollment.student_id = student.id AND active_enrollment.teacher_id = student.teacher_id AND active_enrollment.unenrolled_at IS NULL',
    )
    .select('student.id', 'student_id')
    .addSelect('student.full_name', 'student_name')
    .addSelect('active_enrollment.class_id', 'active_class_id')
    .where('student.teacher_id = :teacherId', { teacherId });
}

export async function listStudentMessageRecipientBasesByStudentIds(
  teacherId: number,
  studentIds: number[],
): Promise<StudentMessageRecipientBase[]> {
  if (studentIds.length === 0) {
    return [];
  }

  const rows = await studentMessageRecipientBaseQuery(teacherId)
    .andWhere('student.id IN (:...studentIds)', { studentIds })
    .getRawMany<{
      student_id: number | string;
      student_name: string;
      active_class_id: number | string | null;
    }>();
  const contextByStudentId = new Map(
    rows.map((row) => {
      const context = toStudentMessageRecipientBase(row);
      return [context.student_id, context];
    }),
  );

  return studentIds
    .map((studentId) => contextByStudentId.get(studentId))
    .filter((context): context is StudentMessageRecipientBase => context !== undefined);
}

export async function listStudentMessageRecipientBasesByClass(
  teacherId: number,
  classId: number,
): Promise<StudentMessageRecipientBase[]> {
  const rows = await studentMessageRecipientBaseQuery(teacherId)
    .innerJoin(
      Enrollment,
      'class_enrollment',
      'class_enrollment.student_id = student.id AND class_enrollment.teacher_id = student.teacher_id AND class_enrollment.class_id = :classId AND class_enrollment.unenrolled_at IS NULL',
      { classId },
    )
    .orderBy('student.full_name', 'ASC')
    .addOrderBy('student.id', 'ASC')
    .getRawMany<{
      student_id: number | string;
      student_name: string;
      active_class_id: number | string | null;
    }>();

  return rows.map((row) => toStudentMessageRecipientBase(row));
}

export async function listStudentEnrollments(
  teacherId: number,
  studentId: number,
): Promise<StudentEnrollmentSummary[]> {
  const enrollments = await AppDataSource.getRepository(Enrollment).find({
    where: {
      teacher_id: teacherId,
      student_id: studentId,
    },
    order: {
      enrolled_at: 'DESC',
      id: 'DESC',
    },
  });

  return enrollments.map((enrollment) => ({
    id: enrollment.id,
    teacher_id: enrollment.teacher_id,
    student_id: enrollment.student_id,
    class_id: enrollment.class_id,
    enrolled_at: enrollment.enrolled_at,
    unenrolled_at: enrollment.unenrolled_at,
  }));
}

export async function findOwnedStudent(
  manager: EntityManager,
  teacherId: number,
  studentId: number,
): Promise<Student | null> {
  return manager.getRepository(Student).findOneBy({
    id: studentId,
    teacher_id: teacherId,
  });
}

export async function listStudentsForTeacher(
  manager: EntityManager,
  teacherId: number,
  filters: StudentListFilters,
): Promise<Student[]> {
  const queryBuilder = manager
    .getRepository(Student)
    .createQueryBuilder('student')
    .leftJoin(StudentDiscordCredential, 'discord_credential', 'discord_credential.student_id = student.id')
    .addSelect('discord_credential.discord_username', 'student_discord_username')
    .addSelect('discord_credential.discord_user_id', 'student_discord_user_id')
    .where('student.teacher_id = :teacherId', { teacherId });

  if (filters.status !== undefined) {
    queryBuilder.andWhere('student.status = :status', { status: filters.status });
  }

  if (filters.pending_archive_reason !== undefined) {
    queryBuilder.andWhere('student.pending_archive_reason = :pendingArchiveReason', {
      pendingArchiveReason: filters.pending_archive_reason,
    });
  }

  if (filters.search !== undefined) {
    queryBuilder.andWhere(
      `(
        LOWER(student.full_name) LIKE LOWER(:search)
        OR LOWER(student.codeforces_handle) LIKE LOWER(:search)
        OR LOWER(discord_credential.discord_username) LIKE LOWER(:search)
        OR LOWER(student.phone) LIKE LOWER(:search)
      )`,
      { search: `%${filters.search}%` },
    );
  }

  if (filters.class_id !== undefined) {
    queryBuilder.innerJoin(
      Enrollment,
      'active_enrollment',
      `
        active_enrollment.teacher_id = student.teacher_id
        AND active_enrollment.student_id = student.id
        AND active_enrollment.unenrolled_at IS NULL
        AND active_enrollment.class_id = :classId
      `,
      { classId: filters.class_id },
    );
  }

  const result = await queryBuilder
    .orderBy('student.created_at', 'DESC')
    .getRawAndEntities<{
      student_discord_username: string | null;
      student_discord_user_id: string | null;
    }>();

  return result.entities.map((student, index) => Object.assign(student, {
    discord_username: result.raw[index]?.student_discord_username ?? null,
    discord_user_id: result.raw[index]?.student_discord_user_id ?? null,
  }));
}

export async function codeforcesHandleExists(
  manager: EntityManager,
  teacherId: number,
  codeforcesHandle: string,
  excludeStudentId?: number,
): Promise<boolean> {
  const queryBuilder = manager
    .getRepository(Student)
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

export async function findActiveEnrollment(
  manager: EntityManager,
  teacherId: number,
  studentId: number,
): Promise<Enrollment | null> {
  return manager.getRepository(Enrollment).findOne({
    where: {
      teacher_id: teacherId,
      student_id: studentId,
      unenrolled_at: IsNull(),
    },
  });
}

export async function findActiveEnrollmentsByStudentIds(
  manager: EntityManager,
  teacherId: number,
  studentIds: number[],
): Promise<Enrollment[]> {
  if (studentIds.length === 0) {
    return [];
  }

  return manager.getRepository(Enrollment).find({
    where: {
      teacher_id: teacherId,
      student_id: In(studentIds),
      unenrolled_at: IsNull(),
    },
  });
}

export async function findLastEnrollment(
  manager: EntityManager,
  teacherId: number,
  studentId: number,
): Promise<Enrollment | null> {
  return manager.getRepository(Enrollment).findOne({
    where: { teacher_id: teacherId, student_id: studentId },
    order: { id: 'DESC' },
  });
}

export async function findRecentEnrollments(
  manager: EntityManager,
  teacherId: number,
  studentId: number,
  take: number,
): Promise<Enrollment[]> {
  return manager.getRepository(Enrollment).find({
    where: { teacher_id: teacherId, student_id: studentId },
    order: { id: 'DESC' },
    take,
  });
}

export async function findDiscordGuildByClass(
  manager: EntityManager,
  teacherId: number,
  classId: number,
): Promise<ClassDiscordBinding | null> {
  return manager.getRepository(ClassDiscordBinding).findOneBy({
    teacher_id: teacherId,
    class_id: classId,
  });
}

export async function loadBalanceSnapshots(
  manager: EntityManager,
  teacherId: number,
  studentIds: number[],
): Promise<Map<number, StudentBalanceSnapshot>> {
  const transactionTotals = await loadTransactionTotals(manager, teacherId, studentIds);
  const activeFeeTotals = await loadActiveFeeTotals(manager, teacherId, studentIds);

  const balanceSnapshots = new Map<number, StudentBalanceSnapshot>();

  studentIds.forEach((studentId) => {
    const transactionsTotal = transactionTotals.get(studentId) ?? 0n;
    const activeFeeTotal = activeFeeTotals.get(studentId) ?? 0n;
    const balance = transactionsTotal - activeFeeTotal;

    balanceSnapshots.set(studentId, {
      transactions_total: transactionsTotal.toString(),
      active_fee_total: activeFeeTotal.toString(),
      balance: balance.toString(),
    });
  });

  return balanceSnapshots;
}

export async function loadBalanceSnapshotForStudent(
  manager: EntityManager,
  teacherId: number,
  studentId: number,
): Promise<StudentBalanceSnapshot> {
  const snapshots = await loadBalanceSnapshots(manager, teacherId, [studentId]);
  return snapshots.get(studentId) ?? createZeroBalanceSnapshot();
}

async function loadTransactionTotals(
  manager: EntityManager,
  teacherId: number,
  studentIds: number[],
): Promise<Map<number, bigint>> {
  if (studentIds.length === 0) {
    return new Map();
  }

  const rows = await manager
    .getRepository(Transaction)
    .createQueryBuilder('transaction')
    .select('transaction.student_id', 'student_id')
    .addSelect('COALESCE(SUM(transaction.amount), 0)', 'total')
    .where('transaction.teacher_id = :teacherId', { teacherId })
    .andWhere('transaction.student_id IN (:...studentIds)', { studentIds })
    .groupBy('transaction.student_id')
    .getRawMany<{ student_id: string; total: string }>();

  return new Map(rows.map((row) => [Number(row.student_id), parseAmountToBigInt(row.total)]));
}

async function loadActiveFeeTotals(
  manager: EntityManager,
  teacherId: number,
  studentIds: number[],
): Promise<Map<number, bigint>> {
  if (studentIds.length === 0) {
    return new Map();
  }

  const rows = await manager
    .getRepository(FeeRecord)
    .createQueryBuilder('fee_record')
    .select('fee_record.student_id', 'student_id')
    .addSelect('COALESCE(SUM(fee_record.amount), 0)', 'total')
    .where('fee_record.teacher_id = :teacherId', { teacherId })
    .andWhere('fee_record.student_id IN (:...studentIds)', { studentIds })
    .andWhere('fee_record.status = :status', { status: FeeRecordStatus.Active })
    .groupBy('fee_record.student_id')
    .getRawMany<{ student_id: string; total: string }>();

  return new Map(rows.map((row) => [Number(row.student_id), parseAmountToBigInt(row.total)]));
}

// TypeOrmBalanceSnapshotReader.ts
export class TypeOrmBalanceSnapshotReader {
  constructor(private readonly manager: EntityManager) {}

  loadForStudent(teacherId: number, studentId: number): Promise<StudentBalanceSnapshot> {
    return loadBalanceSnapshotForStudent(this.manager, teacherId, studentId);
  }
}

// TypeOrmClassroomAccess.ts
export class TypeOrmClassroomAccess {
  constructor(private readonly manager: EntityManager) {}

  async ensureActiveClass(teacherId: number, classId: number): Promise<void> {
    const classEntity = await this.manager.getRepository(Class).findOneBy({
      id: classId,
      teacher_id: teacherId,
    });

    if (!classEntity) {
      throw new HttpError('class not found', 404);
    }

    if (classEntity.status !== ClassStatus.Active) {
      throw new HttpError('class is archived', 409);
    }

    const scheduleCount = await this.manager.getRepository(ClassSchedule).countBy({
      teacher_id: teacherId,
      class_id: classId,
    });
    if (scheduleCount === 0) {
      throw new HttpError('class must have at least one schedule', 409);
    }

  }
}

// TypeOrmFinanceReportReader.ts
export type StudentBalanceRow = {
  balance: string;
};

export type FinanceSummaryView = {
  net_revenue: string;
};

export type StudentTransactionListView = {
  items: unknown[];
};

const financeReader = new TypeOrmTransactionReader();

export class TypeOrmFinanceReportReader {
  getFinanceSummary(input: {
    teacherId: number;
    from: Date;
    to: Date;
    includeUnpaid: boolean;
  }): Promise<FinanceSummaryView> {
    return financeReader.getFinanceSummary(input.teacherId, {
      from: input.from,
      to: input.to,
      include_unpaid: input.includeUnpaid,
    });
  }

  listStudentBalances(input: {
    teacherId: number;
    status: string;
    includePendingArchive: boolean;
  }): Promise<StudentBalanceRow[]> {
    return financeReader.listStudentBalances(input.teacherId, {
      status: input.status as never,
      include_pending_archive: input.includePendingArchive,
    }) as Promise<StudentBalanceRow[]>;
  }

  listTransactions(input: {
    teacherId: number;
    studentId: number;
  }): Promise<StudentTransactionListView> {
    return financeReader.listTransactions(input.teacherId, { student_id: input.studentId });
  }
}

// TypeOrmStudentReader.ts
export class TypeOrmStudentReader {
  constructor(private readonly manager: EntityManager) {}

  countOwnedStudents(teacherId: number, studentIds: number[]): Promise<number> {
    if (studentIds.length === 0) {
      return Promise.resolve(0);
    }

    return this.manager.getRepository(Student).countBy({
      id: In(studentIds),
      teacher_id: teacherId,
    });
  }

  async listActiveCodeforcesStudentsForClass(
    teacherId: number,
    classId: number,
  ): Promise<Array<{ id: number; codeforces_handle: string | null }>> {
    const enrollments = await this.manager.getRepository(Enrollment).findBy({
      teacher_id: teacherId,
      class_id: classId,
      unenrolled_at: IsNull(),
    });
    const studentIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.student_id)));

    if (studentIds.length === 0) {
      return [];
    }

    const students = await this.manager.getRepository(Student).findBy({
      teacher_id: teacherId,
      id: In(studentIds),
    });

    return students.map((student) => ({
      id: student.id,
      codeforces_handle: student.codeforces_handle,
    }));
  }

  async listStudents(teacherId: number, filters: StudentListFilters): Promise<StudentSummary[]> {
    const students = await listStudentsForTeacher(this.manager, teacherId, filters);

    if (students.length === 0) {
      return [];
    }

    const studentIds = students.map((student) => student.id);
    const activeEnrollments = await findActiveEnrollmentsByStudentIds(this.manager, teacherId, studentIds);
    const activeEnrollmentByStudentId = new Map<number, (typeof activeEnrollments)[number]>();
    activeEnrollments.forEach((enrollment) => {
      activeEnrollmentByStudentId.set(enrollment.student_id, enrollment);
    });

    const balanceByStudentId = await loadBalanceSnapshots(this.manager, teacherId, studentIds);

    return students.map((student) => {
      const activeEnrollment = activeEnrollmentByStudentId.get(student.id) ?? null;
      const balanceSnapshot = balanceByStudentId.get(student.id) ?? createZeroBalanceSnapshot();

      return toStudentSummary(student, {
        current_class_id: activeEnrollment?.class_id ?? null,
        current_enrollment_id: activeEnrollment?.id ?? null,
        balance_snapshot: balanceSnapshot,
      });
    });
  }

  async getStudentById(teacherId: number, studentId: number): Promise<StudentSummary> {
    const student = await this.manager.getRepository(Student).findOneBy({ id: studentId });
    if (!student) {
      throw new DomainError('student_not_found', 'student not found');
    }

    const activeEnrollment = await findActiveEnrollment(this.manager, teacherId, studentId);
    const balanceSnapshot = await loadBalanceSnapshotForStudent(this.manager, teacherId, studentId);

    return toStudentSummary(student, {
      current_class_id: activeEnrollment?.class_id ?? null,
      current_enrollment_id: activeEnrollment?.id ?? null,
      balance_snapshot: balanceSnapshot,
    });
  }
}

// TypeOrmStudentReportReader.ts
export class TypeOrmStudentReportReader {
  constructor(
    private readonly source = new TypeOrmStudentReportSourceReader(),
  ) {}

  countActiveStudents(teacherId: number): Promise<number> {
    return this.source.countActiveStudents(teacherId);
  }

  countActiveClasses(teacherId: number): Promise<number> {
    return this.source.countActiveClasses(teacherId);
  }

  async getStudentLearningProfileSource(teacherId: number, studentId: number) {
    const student = await this.source.findOwnedStudent(teacherId, studentId);
    if (!student) {
      throw new DomainError('student_not_found', 'student not found');
    }

    const standings = await this.source.findStudentTopicStandings(teacherId, studentId);
    const topicIds = Array.from(new Set(standings.map((item) => item.topic_id)));
    const problemIds = Array.from(new Set(standings.map((item) => item.problem_id)));
    const topics = (await this.source.findTopicsByIds(teacherId, topicIds))
      .filter((topic): topic is typeof topic & { class_id: number } => topic.class_id !== null);
    const problems = await this.source.findTopicProblemsByIds(teacherId, problemIds);
    const classIds = Array.from(new Set(topics.map((topic) => topic.class_id)));
    const classes = await this.source.findClassesByIds(teacherId, classIds);

    return {
      student,
      standings,
      topics,
      problems,
      classes,
    };
  }
}

// TypeOrmStudentReportSourceReader.ts
export class TypeOrmStudentReportSourceReader {
  countActiveStudents(teacherId: number): Promise<number> {
    return AppDataSource.getRepository(Student).countBy({
      teacher_id: teacherId,
      status: StudentStatus.Active,
    });
  }

  countActiveClasses(teacherId: number): Promise<number> {
    return AppDataSource.getRepository(Class).countBy({
      teacher_id: teacherId,
      status: ClassStatus.Active,
    });
  }

  findOwnedStudent(teacherId: number, studentId: number): Promise<Student | null> {
    return AppDataSource.getRepository(Student).findOneBy({
      id: studentId,
      teacher_id: teacherId,
    });
  }

  findClassesByIds(teacherId: number, classIds: number[]): Promise<Class[]> {
    return classIds.length > 0
      ? AppDataSource.getRepository(Class).findBy({ teacher_id: teacherId, id: In(classIds) })
      : Promise.resolve([]);
  }

  findTopicsByIds(teacherId: number, topicIds: number[]): Promise<Gym[]> {
    return topicIds.length > 0
      ? AppDataSource.getRepository(Gym).findBy({ teacher_id: teacherId, id: In(topicIds) })
      : Promise.resolve([]);
  }

  findTopicProblemsByIds(teacherId: number, problemIds: number[]): Promise<GymProblem[]> {
    return problemIds.length > 0
      ? AppDataSource.getRepository(GymProblem).findBy({ teacher_id: teacherId, id: In(problemIds) })
      : Promise.resolve([]);
  }

  findStudentTopicStandings(teacherId: number, studentId: number): Promise<GymStanding[]> {
    return AppDataSource.getRepository(GymStanding).find({
      where: {
        teacher_id: teacherId,
        student_id: studentId,
      },
      order: {
        pulled_at: 'DESC',
      },
    });
  }
}
