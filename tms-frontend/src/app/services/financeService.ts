import { apiRequest } from "./apiClient";
import type { BackendStudentStatus } from "./studentService";

export type BackendTransactionType = "payment" | "refund";
export type BackendFeeRecordStatus = "active" | "cancelled";

export interface BackendTransaction {
  id: number;
  teacher_id: number;
  student_id: number;
  amount: string;
  type: BackendTransactionType;
  recorded_at: string;
  notes: string | null;
  updated_at: string;
}

export interface BackendFeeRecord {
  id: number;
  teacher_id: number;
  student_id: number;
  session_id: number;
  enrollment_id: number;
  amount: string;
  status: BackendFeeRecordStatus;
  created_at: string;
  cancelled_at: string | null;
}

export interface BackendStudentBalance {
  student_id: number;
  full_name: string;
  status: BackendStudentStatus;
  pending_archive_reason: "needs_collection" | "needs_refund" | null;
  transactions_total: string;
  active_fee_total: string;
  balance: string;
}

export interface BackendFinanceSummary {
  total_payments: string;
  total_refunds: string;
  total_active_fees: string;
  unpaid_total: string;
  net_revenue: string;
  projected_revenue: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    query.set(key, String(value));
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export async function listTransactions(filters?: {
  student_id?: number;
  type?: BackendTransactionType;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<BackendTransaction[]> {
  const data = await apiRequest<{ transactions: BackendTransaction[] }>(
    `/finance/transactions${buildQuery({
      student_id: filters?.student_id,
      type: filters?.type,
      from: filters?.from,
      to: filters?.to,
      limit: filters?.limit,
      offset: filters?.offset,
    })}`,
  );

  return data.transactions;
}

export async function createTransaction(payload: {
  student_id: number;
  amount: string;
  type: BackendTransactionType;
  notes?: string | null;
  recorded_at?: string;
}): Promise<BackendTransaction> {
  const data = await apiRequest<{ transaction: BackendTransaction }>("/finance/transactions", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return data.transaction;
}

export async function updateTransaction(id: number, payload: {
  student_id: number;
  amount: string;
  type: BackendTransactionType;
  notes?: string | null;
  recorded_at?: string;
}): Promise<BackendTransaction> {
  const data = await apiRequest<{ transaction: BackendTransaction }>(`/finance/transactions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return data.transaction;
}

export async function listFeeRecords(filters?: {
  student_id?: number;
  session_id?: number;
  status?: BackendFeeRecordStatus;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<BackendFeeRecord[]> {
  const data = await apiRequest<{ fee_records: BackendFeeRecord[] }>(
    `/finance/fee-records${buildQuery({
      student_id: filters?.student_id,
      session_id: filters?.session_id,
      status: filters?.status,
      from: filters?.from,
      to: filters?.to,
      limit: filters?.limit,
      offset: filters?.offset,
    })}`,
  );

  return data.fee_records;
}

export async function updateFeeRecordStatus(
  feeRecordId: number,
  status: BackendFeeRecordStatus,
): Promise<BackendFeeRecord> {
  const data = await apiRequest<{ fee_record: BackendFeeRecord }>(`/finance/fee-records/${feeRecordId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

  return data.fee_record;
}

export async function listStudentBalances(filters?: {
  status?: BackendStudentStatus;
  include_pending_archive?: boolean;
}): Promise<BackendStudentBalance[]> {
  const data = await apiRequest<{ balances: BackendStudentBalance[] }>(
    `/finance/balances${buildQuery({
      status: filters?.status,
      include_pending_archive: filters?.include_pending_archive,
    })}`,
  );

  return data.balances;
}

export async function getFinanceSummary(filters?: {
  from?: string;
  to?: string;
  class_ids?: number[];
  include_unpaid?: boolean;
}): Promise<BackendFinanceSummary> {
  const params = new URLSearchParams();

  if (filters?.from) {
    params.set("from", filters.from);
  }

  if (filters?.to) {
    params.set("to", filters.to);
  }

  if (filters?.class_ids) {
    params.set("class_ids", filters.class_ids.join(","));
  }

  if (filters?.include_unpaid !== undefined) {
    params.set("include_unpaid", String(filters.include_unpaid));
  }

  const path = params.toString() ? `/finance/summary?${params.toString()}` : "/finance/summary";
  const data = await apiRequest<{ summary: BackendFinanceSummary }>(path);
  return data.summary;
}
