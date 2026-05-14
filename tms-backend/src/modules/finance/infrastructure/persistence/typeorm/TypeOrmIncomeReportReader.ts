import { In, IsNull, type EntityManager } from 'typeorm';

import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { Enrollment } from '../../../../../entities/enrollment.entity.js';
import { FeeRecordStatus } from '../../../../../entities/enums.js';
import { Student } from '../../../../../entities/student.entity.js';
import { ServiceError } from '../../../../../shared/errors/service.error.js';
import { parseAmountToBigInt } from '../../../../../shared/helpers/money.js';

import { Class } from '../../../../../entities/class.entity.js';
import { FeeRecord } from '../../../../../entities/fee-record.entity.js';
import { Transaction } from '../../../../../entities/transaction.entity.js';

export class TypeOrmIncomeReportReader {
  constructor(private readonly manager: EntityManager = AppDataSource.manager) {}

  findReportClasses(teacherId: number, classIds?: number[]) {
    return this.manager.getRepository(Class).find({
      where: {
        teacher_id: teacherId,
        ...(classIds && classIds.length > 0 ? { id: In(classIds) } : {}),
      },
    });
  }

  async countActiveEnrollmentsByClass(teacherId: number, classIds: number[]) {
    const rows = await this.manager.getRepository(Enrollment)
      .createQueryBuilder('enrollment')
      .select('enrollment.class_id', 'class_id')
      .addSelect('COUNT(*)', 'student_count')
      .where('enrollment.teacher_id = :teacherId', { teacherId })
      .andWhere('enrollment.unenrolled_at IS NULL')
      .andWhere(classIds.length > 0 ? 'enrollment.class_id IN (:...classIds)' : '1=1', { classIds })
      .groupBy('enrollment.class_id')
      .getRawMany<{ class_id: string; student_count: string }>();

    return new Map(rows.map((row) => [Number(row.class_id), Number(row.student_count)]));
  }

  async getFinanceSummary(
    teacherId: number,
    filters: {
      from?: Date;
      to?: Date;
      class_ids?: number[];
      include_unpaid?: boolean;
    },
  ) {
    if (filters.from && filters.to && filters.from > filters.to) {
      throw new ServiceError('from must be earlier than or equal to to', 400);
    }

    let scopedStudentIds: number[] | null = null;
    if (filters.class_ids && filters.class_ids.length > 0) {
      const enrollments = await this.manager.getRepository(Enrollment).find({
        where: {
          teacher_id: teacherId,
          class_id: In(filters.class_ids),
          unenrolled_at: IsNull(),
        },
      });

      scopedStudentIds = Array.from(new Set(enrollments.map((item) => item.student_id)));
    }

    if (scopedStudentIds && scopedStudentIds.length === 0) {
      return {
        total_payments: '0',
        total_refunds: '0',
        total_active_fees: '0',
        unpaid_total: '0',
        net_revenue: '0',
        projected_revenue: '0',
      };
    }

    const transactionQuery = this.manager.getRepository(Transaction)
      .createQueryBuilder('transaction')
      .where('transaction.teacher_id = :teacherId', { teacherId });

    const feeQuery = this.manager.getRepository(FeeRecord)
      .createQueryBuilder('fee_record')
      .where('fee_record.teacher_id = :teacherId', { teacherId });

    if (scopedStudentIds && scopedStudentIds.length > 0) {
      transactionQuery.andWhere('transaction.student_id IN (:...studentIds)', { studentIds: scopedStudentIds });
      feeQuery.andWhere('fee_record.student_id IN (:...studentIds)', { studentIds: scopedStudentIds });
    }

    if (filters.from) {
      transactionQuery.andWhere('transaction.recorded_at >= :from', { from: filters.from });
      feeQuery.andWhere('fee_record.created_at >= :from', { from: filters.from });
    }

    if (filters.to) {
      transactionQuery.andWhere('transaction.recorded_at <= :to', { to: filters.to });
      feeQuery.andWhere('fee_record.created_at <= :to', { to: filters.to });
    }

    const transactionSums = await transactionQuery
      .select("COALESCE(SUM(CASE WHEN transaction.type = 'payment' THEN transaction.amount ELSE 0 END), 0)", 'payments')
      .addSelect("COALESCE(SUM(CASE WHEN transaction.type = 'refund' THEN ABS(transaction.amount) ELSE 0 END), 0)", 'refunds')
      .getRawOne<{ payments: string; refunds: string }>();

    const feeSums = await feeQuery
      .select('COALESCE(SUM(CASE WHEN fee_record.status = :activeStatus THEN fee_record.amount ELSE 0 END), 0)', 'active_fees')
      .setParameter('activeStatus', FeeRecordStatus.Active)
      .getRawOne<{ active_fees: string }>();

    const students = await this.manager.getRepository(Student)
      .find({
        where: {
          teacher_id: teacherId,
        },
        order: {
          created_at: 'DESC',
        },
      });
    const filteredStudents = scopedStudentIds
      ? students.filter((student) => scopedStudentIds.includes(student.id))
      : students;
    const studentIds = filteredStudents.map((student) => student.id);

    const transactionTotals = studentIds.length === 0
      ? []
      : await this.manager.getRepository(Transaction)
        .createQueryBuilder('transaction')
        .select('transaction.student_id', 'student_id')
        .addSelect('COALESCE(SUM(transaction.amount), 0)', 'total')
        .where('transaction.teacher_id = :teacherId', { teacherId })
        .andWhere('transaction.student_id IN (:...studentIds)', { studentIds })
        .groupBy('transaction.student_id')
        .getRawMany<{ student_id: string; total: string }>();

    const feeTotals = studentIds.length === 0
      ? []
      : await this.manager.getRepository(FeeRecord)
        .createQueryBuilder('fee_record')
        .select('fee_record.student_id', 'student_id')
        .addSelect('COALESCE(SUM(fee_record.amount), 0)', 'total')
        .where('fee_record.teacher_id = :teacherId', { teacherId })
        .andWhere('fee_record.student_id IN (:...studentIds)', { studentIds })
        .andWhere('fee_record.status = :status', { status: FeeRecordStatus.Active })
        .groupBy('fee_record.student_id')
        .getRawMany<{ student_id: string; total: string }>();

    const transactionMap = new Map(transactionTotals.map((row) => [Number(row.student_id), parseAmountToBigInt(row.total)]));
    const feeMap = new Map(feeTotals.map((row) => [Number(row.student_id), parseAmountToBigInt(row.total)]));

    const unpaidTotal = filteredStudents.reduce((sum, student) => {
      const transactionTotal = transactionMap.get(student.id) ?? 0n;
      const activeFeeTotal = feeMap.get(student.id) ?? 0n;
      const balance = transactionTotal - activeFeeTotal;

      if (balance < 0n) {
        return sum + (balance * -1n);
      }

      return sum;
    }, 0n);

    const totalPayments = parseAmountToBigInt(transactionSums?.payments);
    const totalRefunds = parseAmountToBigInt(transactionSums?.refunds);
    const totalActiveFees = parseAmountToBigInt(feeSums?.active_fees);
    const netRevenue = totalPayments - totalRefunds;
    const projectedRevenue = filters.include_unpaid ? netRevenue + unpaidTotal : netRevenue;

    return {
      total_payments: totalPayments.toString(),
      total_refunds: totalRefunds.toString(),
      total_active_fees: totalActiveFees.toString(),
      unpaid_total: unpaidTotal.toString(),
      net_revenue: netRevenue.toString(),
      projected_revenue: projectedRevenue.toString(),
    };
  }
}
