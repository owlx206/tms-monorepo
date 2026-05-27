import type { StudentStatus } from '../../student/contracts/types.js';

export enum FeeRecordStatus {
  Active = 'active',
  Cancelled = 'cancelled',
}

export enum TransactionType {
  Payment = 'payment',
  Refund = 'refund',
}

export type TransactionListFilters = {
  student_id?: number;
  type?: TransactionType;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
};

export type CreateTransactionInput = {
  student_id: number;
  amount: string;
  type: TransactionType;
  notes?: string | null;
  recorded_at?: Date;
};

export type UpdateTransactionInput = {
  student_id: number;
  amount: string;
  type: TransactionType;
  notes?: string | null;
  recorded_at?: Date;
};

export type FeeRecordListFilters = {
  student_id?: number;
  session_id?: number;
  status?: FeeRecordStatus;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
};

export type UpdateFeeRecordStatusInput = {
  status: FeeRecordStatus;
};

export type StudentBalancesFilters = {
  status?: StudentStatus;
  include_pending_archive?: boolean;
};

export type IncomeReportFilters = {
  from?: Date;
  to?: Date;
  class_ids?: number[];
  include_unpaid?: boolean;
};
