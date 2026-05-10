import { EntityManager, In, IsNull } from 'typeorm';

import { DiscordServer } from '../../../../../entities/discord-server.entity.js';
import { FeeRecord } from '../../../../../entities/fee-record.entity.js';
import { FeeRecordStatus } from '../../../../../entities/enums.js';
import { Transaction } from '../../../../../entities/transaction.entity.js';
import { parseAmountToBigInt } from '../../../../../shared/helpers/money.js';
import type { StudentBalanceSnapshot, StudentListFilters } from '../../../application/dto/StudentDto.js';
import { Enrollment } from './EnrollmentOrmEntity.js';
import { Student } from './StudentOrmEntity.js';

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
        student.full_name ILIKE :search
        OR student.codeforces_handle ILIKE :search
        OR student.discord_username ILIKE :search
        OR student.phone ILIKE :search
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

export async function findDiscordServerByClass(
  manager: EntityManager,
  teacherId: number,
  classId: number,
): Promise<DiscordServer | null> {
  return manager.getRepository(DiscordServer).findOneBy({
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
