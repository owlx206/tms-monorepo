import { QueryFailedError } from 'typeorm';

import { TransactionType } from '../../contracts/types.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';
import { parseAmountToBigInt } from '../../domain/Money.js';
import type { TypeOrmTransactionWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

function isRefundBalanceConstraintError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as { constraint?: string };
  return driverError.constraint === 'chk_transactions_refund_not_over_payment';
}

function validateTransactionAmount(type: TransactionType, amount: bigint): void {
  if (amount === 0n) {
    throw new HttpError('amount must be non-zero', 400);
  }

  if (type === TransactionType.Payment && amount <= 0n) {
    throw new HttpError('payment amount must be positive', 400);
  }

  if (type === TransactionType.Refund && amount >= 0n) {
    throw new HttpError('refund amount must be negative', 400);
  }
}

export class UpdateTransactionUseCase {
  constructor(private readonly transactionWriter: TypeOrmTransactionWriter) {}

  async execute(input: {
    teacherId: number;
    transactionId: number;
    studentId: number;
    amount: string;
    type: TransactionType;
    notes?: string | null;
    recordedAt?: Date;
    updateReason?: string | null;
  }) {
    const transaction = await this.transactionWriter.findOwnedTransaction(
      input.teacherId,
      input.transactionId,
    );

    if (!transaction) {
      throw new HttpError('transaction not found', 404);
    }

    const student = await this.transactionWriter.findOwnedStudent(input.teacherId, input.studentId);

    if (!student) {
      throw new HttpError('student not found', 404);
    }

    const amount = parseAmountToBigInt(input.amount);
    validateTransactionAmount(input.type, amount);

    const totals = await this.transactionWriter.getStudentTransactionTotals(input.teacherId, input.studentId, {
      excludeTransactionId: input.transactionId,
    });
    const totalPayments = totals.payments + (input.type === TransactionType.Payment ? amount : 0n);
    const totalRefunds = totals.refunds + (input.type === TransactionType.Refund ? amount * -1n : 0n);

    if (totalRefunds > totalPayments) {
      throw new HttpError('Tổng số tiền hoàn trả không được lớn hơn tổng số tiền đã nhận', 400);
    }

    const oldSnapshot = {
      student_id: transaction.student_id,
      amount: transaction.amount,
      type: transaction.type,
      notes: transaction.notes,
      recorded_at: transaction.recorded_at,
    };

    transaction.student_id = input.studentId;
    transaction.amount = amount.toString();
    transaction.type = input.type;
    transaction.notes = input.notes ?? null;
    transaction.recorded_at = input.recordedAt ?? transaction.recorded_at;

    try {
      return await this.transactionWriter.saveWithAuditLog(
        input.teacherId,
        input.transactionId,
        transaction,
        {
          old_student_id: oldSnapshot.student_id,
          new_student_id: transaction.student_id,
          old_amount: oldSnapshot.amount,
          new_amount: transaction.amount,
          old_type: oldSnapshot.type,
          new_type: transaction.type,
          old_recorded_at: oldSnapshot.recorded_at,
          new_recorded_at: transaction.recorded_at,
          old_notes: oldSnapshot.notes,
          new_notes: transaction.notes,
          reason: input.updateReason ?? null,
        },
      );
    } catch (error) {
      if (isRefundBalanceConstraintError(error)) {
        throw new HttpError('Tổng số tiền hoàn trả không được lớn hơn tổng số tiền đã nhận', 400);
      }

      throw error;
    }
  }
}
