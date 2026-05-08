import { apiRequest } from "./apiClient";

export type BackendStudentStatus = "active" | "pending_archive" | "archived";
export type BackendPendingArchiveReason = "needs_collection" | "needs_refund";

export interface BackendStudentSummary {
  id: number;
  teacher_id: number;
  full_name: string;
  codeforces_handle: string | null;
  discord_username: string | null;
  discord_user_id: string | null;
  phone: string | null;
  note: string | null;
  status: BackendStudentStatus;
  pending_archive_reason: BackendPendingArchiveReason | null;
  created_at: string;
  archived_at: string | null;
  current_class_id: number | null;
  current_enrollment_id: number | null;
  transactions_total: string;
  active_fee_total: string;
  balance: string;
}

type ListStudentsResponse = {
  students: BackendStudentSummary[];
};

type StudentResponse = {
  student: BackendStudentSummary;
};

function toClassIdOrNull(classId: string): number | null {
  const parsed = Number(classId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function listStudents(filters?: {
  status?: BackendStudentStatus;
  pending_archive_reason?: BackendPendingArchiveReason;
  class_id?: number;
  search?: string;
}): Promise<BackendStudentSummary[]> {
  const query = new URLSearchParams();

  if (filters?.status) {
    query.set("status", filters.status);
  }

  if (filters?.pending_archive_reason) {
    query.set("pending_archive_reason", filters.pending_archive_reason);
  }

  if (filters?.class_id !== undefined) {
    query.set("class_id", String(filters.class_id));
  }

  if (filters?.search) {
    query.set("search", filters.search);
  }

  const suffix = query.toString();
  const path = suffix ? `/students?${suffix}` : "/students";
  const data = await apiRequest<ListStudentsResponse>(path);
  return data.students;
}

export async function getStudent(studentId: number): Promise<BackendStudentSummary> {
  const data = await apiRequest<StudentResponse>(`/students/${studentId}`);
  return data.student;
}

export async function createStudent(payload: {
  full_name: string;
  class_id: number;
  codeforces_handle: string | null;
  discord_username: string;
  discord_user_id?: string | null;
  phone?: string | null;
  note: string | null;
}): Promise<BackendStudentSummary> {
  const data = await apiRequest<StudentResponse>("/students", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return data.student;
}

export async function updateStudent(payload: {
  student_id: number;
  full_name?: string;
  codeforces_handle?: string | null;
  discord_username?: string;
  discord_user_id?: string | null;
  phone?: string | null;
  note?: string | null;
}): Promise<BackendStudentSummary> {
  const { student_id, ...patch } = payload;
  const data = await apiRequest<StudentResponse>(`/students/${student_id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

  return data.student;
}

export async function inviteStudentToCurrentClassDiscord(studentId: number): Promise<{
  sent: boolean;
  reason: string | null;
}> {
  return apiRequest<{ sent: boolean; reason: string | null }>(
    `/students/${studentId}/discord/invite-current-class`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function transferStudent(payload: {
  student_id: number;
  to_class_id: number;
}): Promise<BackendStudentSummary> {
  const data = await apiRequest<StudentResponse>(`/students/${payload.student_id}/transfer`, {
    method: "POST",
    body: JSON.stringify({
      to_class_id: payload.to_class_id,
    }),
  });

  return data.student;
}

export async function bulkTransferStudents(payload: {
  student_ids: number[];
  to_class_id: number;
}): Promise<BackendStudentSummary[]> {
  const data = await apiRequest<ListStudentsResponse>("/students/bulk/transfer", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return data.students;
}

export async function withdrawStudent(studentId: number): Promise<BackendStudentSummary> {
  const data = await apiRequest<StudentResponse>(`/students/${studentId}/withdraw`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  return data.student;
}

export async function bulkWithdrawStudents(student_ids: number[]): Promise<BackendStudentSummary[]> {
  const data = await apiRequest<ListStudentsResponse>("/students/bulk/withdraw", {
    method: "POST",
    body: JSON.stringify({ student_ids }),
  });

  return data.students;
}

export async function reinstateStudent(payload: {
  student_id: number;
  class_id: number;
}): Promise<BackendStudentSummary> {
  const data = await apiRequest<StudentResponse>(`/students/${payload.student_id}/reinstate`, {
    method: "POST",
    body: JSON.stringify({
      class_id: payload.class_id,
    }),
  });

  return data.student;
}

export async function archiveStudent(studentId: number, options?: {
  settle_finance?: boolean;
}): Promise<BackendStudentSummary> {
  const data = await apiRequest<StudentResponse>(`/students/${studentId}/archive`, {
    method: "POST",
    body: JSON.stringify({
      settle_finance: options?.settle_finance ?? false,
    }),
  });

  return data.student;
}

export function buildStudentNote(email: string): string | null {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    return null;
  }

  return `email:${normalizedEmail}`;
}

export function parseStudentId(value: string): number | null {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function parseStudentClassId(value: string): number | null {
  return toClassIdOrNull(value);
}
