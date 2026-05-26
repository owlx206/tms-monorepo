import { QueryFailedError } from 'typeorm';

import { HttpError } from '../../../../shared/errors/HttpError.js';
import {
  assertRefundsDoNotExceedPayments,
  assertTransactionKeepsRefundBalance,
  parseAmountToBigInt,
} from '../../domain/Money.js';
import type { TransactionType } from '../../contracts/types.js';
import type { TypeOrmTransactionWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

function isRefundBalanceConstraintError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as { constraint?: string };
  return driverError.constraint === 'chk_transactions_refund_not_over_payment';
}

export class CreateTransaction {
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

    const totals = await this.transactionWriter.getStudentTransactionTotals(input.teacherId, input.studentId);
    assertTransactionKeepsRefundBalance(totals, { type: input.type, amount });

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
        assertRefundsDoNotExceedPayments({ payments: 0n, refunds: 1n });
      }

      throw error;
    }
  }
}
