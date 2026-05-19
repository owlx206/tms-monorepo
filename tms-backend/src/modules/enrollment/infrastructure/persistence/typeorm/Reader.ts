import { EntityManager, In, IsNull } from 'typeorm';
import { ClassDiscordBinding } from '../../../../messaging/infrastructure/persistence/typeorm/entities/class-discord-binding.entity.js';
import { FeeRecord } from '../../../../finance/infrastructure/persistence/typeorm/entities/fee-record.entity.js';
import { FeeRecordStatus } from '../../../../finance/contracts/types.js';
import { Transaction } from '../../../../finance/infrastructure/persistence/typeorm/entities/transaction.entity.js';
import { parseAmountToBigInt } from '../../../../finance/domain/Money.js';
import { type StudentBalanceSnapshot, type StudentListFilters, StudentStatus, type StudentSummary } from '../../../contracts/types.js';
import { Enrollment } from './entities/enrollment.entity.js';
import { Student } from './entities/student.entity.js';
import { Class } from '../../../../classroom/infrastructure/persistence/typeorm/entities/class.entity.js';
import { ClassSchedule } from '../../../../classroom/infrastructure/persistence/typeorm/entities/class-schedule.entity.js';
import { ClassStatus } from '../../../../classroom/contracts/types.js';
import { HttpError } from '../../../../../shared/errors/HttpError.js';
import { TypeOrmTransactionReader } from '../../../../finance/infrastructure/persistence/typeorm/Reader.js';
import { DomainError } from '../../../../../shared/domain/DomainError.js';
import { toStudentSummary } from './Mapper.js';
import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { TopicProblem } from '../../../../topic/infrastructure/persistence/typeorm/entities/topic-problem.entity.js';
import { TopicStanding } from '../../../../topic/infrastructure/persistence/typeorm/entities/topic-standing.entity.js';
import { Topic } from '../../../../topic/infrastructure/persistence/typeorm/entities/topic.entity.js';

// EnrollmentDataAccess.ts
export function createZeroBalanceSnapshot(): StudentBalanceSnapshot {
  return {
    transactions_total: '0',
    active_fee_total: '0',
    balance: '0',
  };
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
        OR LOWER(student.discord_username) LIKE LOWER(:search)
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

  return queryBuilder
    .orderBy('student.created_at', 'DESC')
    .getMany();
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
    const topics = await this.source.findTopicsByIds(teacherId, topicIds);
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

  findTopicsByIds(teacherId: number, topicIds: number[]): Promise<Topic[]> {
    return topicIds.length > 0
      ? AppDataSource.getRepository(Topic).findBy({ teacher_id: teacherId, id: In(topicIds) })
      : Promise.resolve([]);
  }

  findTopicProblemsByIds(teacherId: number, problemIds: number[]): Promise<TopicProblem[]> {
    return problemIds.length > 0
      ? AppDataSource.getRepository(TopicProblem).findBy({ teacher_id: teacherId, id: In(problemIds) })
      : Promise.resolve([]);
  }

  findStudentTopicStandings(teacherId: number, studentId: number): Promise<TopicStanding[]> {
    return AppDataSource.getRepository(TopicStanding).find({
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
