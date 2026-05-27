import { apiRequest } from "./apiClient";

export interface DashboardSummary {
  active_students: number;
  active_classes: number;
  total_debt: string;
  monthly_revenue: string;
}

export interface IncomeReportSummary {
  total_payments: string;
  total_refunds: string;
  total_active_fees: string;
  unpaid_total: string;
  net_revenue: string;
  projected_revenue: string;
}

export interface IncomeReportClassStat {
  class_id: number;
  class_name: string;
  student_count: number;
  fee_per_session: string;
}

export interface IncomeReport {
  summary: IncomeReportSummary;
  class_stats: IncomeReportClassStat[];
}

export interface StudentLearningProfile {
  student: {
    id: number;
    full_name: string;
    status: "active" | "pending_archive" | "archived";
    created_at: string;
  };
  topics: Array<{
    topic_id: number;
    topic_title: string;
    class_id: number;
    class_name: string;
    gym_link: string;
    gym_id: string | null;
    closed_at: string | null;
    solved_count: number;
    total_problems: number;
    last_pulled_at: string | null;
    problems: Array<{
      problem_id: number;
      problem_index: string;
      problem_name: string | null;
      solved: boolean;
      penalty_minutes: number | null;
      pulled_at: string;
    }>;
  }>;
  transactions?: Array<{
    id: number;
    type: "payment" | "refund";
    amount: string;
    recorded_at: string;
    notes: string | null;
  }>;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const data = await apiRequest<{ summary: DashboardSummary }>("/reporting/dashboard");
  return data.summary;
}

export async function getIncomeReport(filters?: {
  from?: string;
  to?: string;
  class_ids?: number[];
  include_unpaid?: boolean;
}): Promise<IncomeReport> {
  const query = new URLSearchParams();

  if (filters?.from) {
    query.set("from", filters.from);
  }

  if (filters?.to) {
    query.set("to", filters.to);
  }

  if (filters?.class_ids && filters.class_ids.length > 0) {
    query.set("class_ids", filters.class_ids.join(","));
  }

  if (filters?.include_unpaid !== undefined) {
    query.set("include_unpaid", String(filters.include_unpaid));
  }

  const path = query.toString() ? `/finance/reporting/income?${query.toString()}` : "/finance/reporting/income";
  return apiRequest<IncomeReport>(path);
}

export async function getStudentLearningProfile(studentId: number): Promise<StudentLearningProfile> {
  return apiRequest<StudentLearningProfile>(`/reporting/students/${studentId}/learning-profile`);
}
