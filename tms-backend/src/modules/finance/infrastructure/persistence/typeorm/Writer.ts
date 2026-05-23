import { type EntityManager, In } from 'typeorm';
import { FeeRecordStatus } from '../../../contracts/types.js';
import { FeeRecord } from '../../../../../infrastructure/database/entities/fee-record.entity.js';
import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { Student } from '../../../../../infrastructure/database/entities/student.entity.js';
import { parseAmountToBigInt } from '../../../domain/Money.js';
import { TransactionAuditLog } from '../../../../../infrastructure/database/entities/transaction-audit-log.entity.js';
import { Transaction } from '../../../../../infrastructure/database/entities/transaction.entity.js';

// FeeRecordSyncDataAccess.ts
export function findFeeRecordForAttendance(
  manager: EntityManager,
  teacherId: number,
  sessionId: number,
  studentId: number,
): Promise<FeeRecord | null> {
  return manager.getRepository(FeeRecord).findOneBy({
    teacher_id: teacherId,
    session_id: sessionId,
    student_id: studentId,
  });
}

export function createFeeRecord(
  manager: EntityManager,
  input: {
    teacher_id: number;
    student_id: number;
    session_id: number;
    enrollment_id: number;
    amount: string;
  },
): FeeRecord {
  const feeRecord = manager.getRepository(FeeRecord).create({
    teacher_id: input.teacher_id,
    student_id: input.student_id,
    session_id: input.session_id,
  });
  feeRecord.activate({
    enrollment_id: input.enrollment_id,
    amount: input.amount,
  });

  return feeRecord;
}

export function saveFeeRecord(
  manager: EntityManager,
  feeRecord: FeeRecord,
): Promise<FeeRecord> {
  return manager.getRepository(FeeRecord).save(feeRecord);
}

export function findActiveFeeRecordsBySessionIds(
  manager: EntityManager,
  teacherId: number,
  sessionIds: number[],
): Promise<FeeRecord[]> {
  if (sessionIds.length === 0) {
    return Promise.resolve([]);
  }

  return manager.getRepository(FeeRecord).find({
    where: {
      teacher_id: teacherId,
      session_id: In(sessionIds),
      status: FeeRecordStatus.Active,
    },
  });
}

export function saveFeeRecords(
  manager: EntityManager,
  feeRecords: FeeRecord[],
): Promise<FeeRecord[]> {
  return manager.getRepository(FeeRecord).save(feeRecords);
}

// TypeOrmFinanceFeeSync.ts
export class TypeOrmFinanceFeeSync {
  async syncAttendanceFeeRecord(
    manager: EntityManager,
    input: {
      teacherId: number;
      sessionId: number;
      studentId: number;
      enrollmentId: number;
      amount: string;
      shouldCharge: boolean;
      cancelledAt?: Date;
    },
  ): Promise<void> {
    const existing = await findFeeRecordForAttendance(
      manager,
      input.teacherId,
      input.sessionId,
      input.studentId,
    );

    if (!input.shouldCharge) {
      if (existing && !existing.isCancelled()) {
        existing.cancel(input.cancelledAt ?? new Date());
        await saveFeeRecord(manager, existing);
      }

      return;
    }

    if (!existing) {
      const feeRecord = createFeeRecord(manager, {
        teacher_id: input.teacherId,
        student_id: input.studentId,
        session_id: input.sessionId,
        enrollment_id: input.enrollmentId,
        amount: input.amount,
      });

      await saveFeeRecord(manager, feeRecord);
      return;
    }

    existing.activate({
      enrollment_id: input.enrollmentId,
      amount: input.amount,
    });
    await saveFeeRecord(manager, existing);
  }

  async cancelFeeRecordsForSessions(
    manager: EntityManager,
    teacherId: number,
    sessionIds: number[],
    cancelledAt: Date = new Date(),
  ): Promise<number> {
    const feeRecords = await findActiveFeeRecordsBySessionIds(manager, teacherId, sessionIds);

    if (feeRecords.length === 0) {
      return 0;
    }

    feeRecords.forEach((feeRecord) => {
      feeRecord.cancel(cancelledAt);
    });

    await saveFeeRecords(manager, feeRecords);
    return feeRecords.length;
  }
}

// TypeOrmTransactionWriter.ts
export class TypeOrmTransactionWriter {
  constructor(private readonly manager: EntityManager = AppDataSource.manager) {}

  async updateFeeRecordStatus(input: {
    teacherId: number;
    feeRecordId: number;
    status: FeeRecordStatus;
  }): Promise<FeeRecord | null> {
    const feeRecordWriter = this.manager.getRepository(FeeRecord);
    const feeRecord = await feeRecordWriter.findOneBy({
      id: input.feeRecordId,
      teacher_id: input.teacherId,
    });

    if (!feeRecord) {
      return null;
    }

    if (feeRecord.status === input.status) {
      return feeRecord;
    }

    feeRecord.setStatus(input.status);
    return feeRecordWriter.save(feeRecord);
  }

  findOwnedStudent(teacherId: number, studentId: number) {
    return this.manager.getRepository(Student).findOneBy({
      id: studentId,
      teacher_id: teacherId,
    });
  }

  findOwnedTransaction(teacherId: number, transactionId: number) {
    return this.manager.getRepository(Transaction).findOneBy({
      id: transactionId,
      teacher_id: teacherId,
    });
  }

  async getStudentTransactionTotals(
    teacherId: number,
    studentId: number,
    options?: { excludeTransactionId?: number },
  ): Promise<{ payments: bigint; refunds: bigint }> {
    const queryBuilder = this.manager.getRepository(Transaction)
      .createQueryBuilder('transaction')
      .select("COALESCE(SUM(CASE WHEN transaction.type = 'payment' THEN transaction.amount ELSE 0 END), 0)", 'payments')
      .addSelect("COALESCE(SUM(CASE WHEN transaction.type = 'refund' THEN ABS(transaction.amount) ELSE 0 END), 0)", 'refunds')
      .where('transaction.teacher_id = :teacherId', { teacherId })
      .andWhere('transaction.student_id = :studentId', { studentId });

    if (options?.excludeTransactionId !== undefined) {
      queryBuilder.andWhere('transaction.id != :transactionId', {
        transactionId: options.excludeTransactionId,
      });
    }

    const totals = await queryBuilder.getRawOne<{ payments: string; refunds: string }>();

    return {
      payments: parseAmountToBigInt(totals?.payments),
      refunds: parseAmountToBigInt(totals?.refunds),
    };
  }

  create(input: {
    teacher_id: number;
    student_id: number;
    amount: string;
    type: import('../../../contracts/types.js').TransactionType;
    notes: string | null;
    recorded_at: Date;
  }) {
    return this.manager.getRepository(Transaction).create(input);
  }

  save(transaction: Transaction) {
    return this.manager.getRepository(Transaction).save(transaction);
  }

  async saveWithAuditLog(
    teacherId: number,
    transactionId: number,
    transaction: Transaction,
    audit: Omit<TransactionAuditLog, 'id' | 'teacher_id' | 'transaction_id' | 'created_at'>,
  ) {
    return this.manager.transaction(async (manager) => {
      const saved = await manager.getRepository(Transaction).save(transaction);
      const auditLog = manager.getRepository(TransactionAuditLog).create({
        teacher_id: teacherId,
        transaction_id: transactionId,
        ...audit,
      });

      await manager.getRepository(TransactionAuditLog).save(auditLog);
      return saved;
    });
  }
}
