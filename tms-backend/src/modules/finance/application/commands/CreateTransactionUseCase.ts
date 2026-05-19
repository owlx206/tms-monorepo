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

export class CreateTransactionUseCase {
  constructor(private readonly transactionWriter: TypeOrmTransactionWriter) {}

  async execute(input: {
    teacherId: number;
    studentId: number;
    amount: string;
    type: TransactionType;
    notes?: string | null;
    recordedAt?: Date;
  }) {
    const student = await this.transactionWriter.findOwnedStudent(input.teacherId, input.studentId);

    if (!student) {
      throw new HttpError('student not found', 404);
    }

    const amount = parseAmountToBigInt(input.amount);
    validateTransactionAmount(input.type, amount);

    const totals = await this.transactionWriter.getStudentTransactionTotals(input.teacherId, input.studentId);
    const totalPayments = totals.payments + (input.type === TransactionType.Payment ? amount : 0n);
    const totalRefunds = totals.refunds + (input.type === TransactionType.Refund ? amount * -1n : 0n);

    if (totalRefunds > totalPayments) {
      throw new HttpError('Tổng số tiền hoàn trả không được lớn hơn tổng số tiền đã nhận', 400);
    }

    const transaction = this.transactionWriter.create({
      teacher_id: input.teacherId,
      student_id: input.studentId,
      amount: amount.toString(),
      type: input.type,
      notes: input.notes ?? null,
      recorded_at: input.recordedAt ?? new Date(),
    });

    try {
      return await this.transactionWriter.save(transaction);
    } catch (error) {
      if (isRefundBalanceConstraintError(error)) {
        throw new HttpError('Tổng số tiền hoàn trả không được lớn hơn tổng số tiền đã nhận', 400);
      }

      throw error;
    }
  }
}
