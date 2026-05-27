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

export class UpdateTransaction {
  constructor(private readonly transactionWriter: TypeOrmTransactionWriter) {}

  async execute(input: {
    teacherId: number;
    transactionId: number;
    studentId: number;
    amount: string;
    type: TransactionType;
    notes?: string | null;
    recordedAt?: Date;
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

    const totals = await this.transactionWriter.getStudentTransactionTotals(input.teacherId, input.studentId, {
      excludeTransactionId: input.transactionId,
    });
    assertTransactionKeepsRefundBalance(totals, { type: input.type, amount });

    transaction.student_id = input.studentId;
    transaction.amount = amount.toString();
    transaction.type = input.type;
    transaction.notes = input.notes ?? null;
    transaction.recorded_at = input.recordedAt ?? transaction.recorded_at;

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
