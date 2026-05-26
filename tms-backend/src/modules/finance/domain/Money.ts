import { TransactionType } from '../contracts/types.js';
import { DomainError } from '../../../shared/domain/DomainError.js';

export function parseAmountToBigInt(value: string | null | undefined): bigint {
  if (!value) {
    return 0n;
  }

  return BigInt(value);
}

export function assertValidTransactionAmount(type: TransactionType, amount: bigint): void {
  if (amount === 0n) {
    throw new DomainError('finance.amount.zero', 'amount must be non-zero');
  }

  if (type === TransactionType.Payment && amount <= 0n) {
    throw new DomainError('finance.payment.amount_not_positive', 'payment amount must be positive');
  }

  if (type === TransactionType.Refund && amount >= 0n) {
    throw new DomainError('finance.refund.amount_not_negative', 'refund amount must be negative');
  }
}

export function nextTransactionTotals(
  currentTotals: { payments: bigint; refunds: bigint },
  transaction: { type: TransactionType; amount: bigint },
): { payments: bigint; refunds: bigint } {
  assertValidTransactionAmount(transaction.type, transaction.amount);

  return {
    payments: currentTotals.payments
      + (transaction.type === TransactionType.Payment ? transaction.amount : 0n),
    refunds: currentTotals.refunds
      + (transaction.type === TransactionType.Refund ? transaction.amount * -1n : 0n),
  };
}

export function assertRefundsDoNotExceedPayments(totals: { payments: bigint; refunds: bigint }): void {
  if (totals.refunds > totals.payments) {
    throw new DomainError(
      'finance.refund.exceeds_payments',
      'Tổng số tiền hoàn trả không được lớn hơn tổng số tiền đã nhận',
    );
  }
}

export function assertTransactionKeepsRefundBalance(
  currentTotals: { payments: bigint; refunds: bigint },
  transaction: { type: TransactionType; amount: bigint },
): { payments: bigint; refunds: bigint } {
  const totals = nextTransactionTotals(currentTotals, transaction);
  assertRefundsDoNotExceedPayments(totals);
  return totals;
}
