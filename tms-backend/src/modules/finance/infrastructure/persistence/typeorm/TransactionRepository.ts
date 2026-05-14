import type { TransactionType } from '../../../../../entities/enums.js';
import type { Student } from '../../../../../entities/student.entity.js';
import type { TransactionAuditLog } from '../../../../../entities/transaction-audit-log.entity.js';
import type { Transaction } from '../../../../../entities/transaction.entity.js';

export interface TransactionRepository {
  findOwnedStudent(teacherId: number, studentId: number): Promise<Student | null>;
  findOwnedTransaction(teacherId: number, transactionId: number): Promise<Transaction | null>;
  getStudentTransactionTotals(
    teacherId: number,
    studentId: number,
    options?: { excludeTransactionId?: number },
  ): Promise<{ payments: bigint; refunds: bigint }>;
  create(input: {
    teacher_id: number;
    student_id: number;
    amount: string;
    type: TransactionType;
    notes: string | null;
    recorded_at: Date;
  }): Transaction;
  save(transaction: Transaction): Promise<Transaction>;
  saveWithAuditLog(
    teacherId: number,
    transactionId: number,
    transaction: Transaction,
    audit: Omit<TransactionAuditLog, 'id' | 'teacher_id' | 'transaction_id' | 'created_at'>,
  ): Promise<Transaction>;
}
