import { apiRequest } from "./apiClient";

export type BackendAttendanceStatus = "present" | "absent_excused" | "absent_unexcused";
export type BackendAttendanceSource = "bot" | "manual" | "system";

export interface SessionAttendanceRow {
  student_id: number;
  student_name: string;
  student_status: "active" | "pending_archive" | "archived";
  attendance_id: number | null;
  attendance_status: BackendAttendanceStatus | null;
  source: BackendAttendanceSource | null;
  notes: string | null;
  overridden_at: string | null;
}

export async function listSessionAttendance(sessionId: number): Promise<{
  session: {
    id: number;
    class_id: number;
    scheduled_at: string;
    status: "scheduled" | "in_progress" | "completed" | "cancelled";
  };
  attendance: SessionAttendanceRow[];
}> {
  return apiRequest(`/sessions/${sessionId}/attendance`);
}

export async function upsertAttendance(
  sessionId: number,
  studentId: number,
  payload: { status: BackendAttendanceStatus; notes?: string | null },
) {
  const data = await apiRequest<{ attendance: unknown }>(
    `/sessions/${sessionId}/attendance/${studentId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );

  return data.attendance;
}

export async function syncSessionAttendance(sessionId: number): Promise<{
  marked_count: number;
}> {
  return apiRequest(`/sessions/${sessionId}/attendance/sync`, {
    method: "POST",
  });
}

export async function listAttendance(filters?: {
  session_id?: number;
  student_id?: number;
  status?: BackendAttendanceStatus;
}): Promise<unknown[]> {
  const query = new URLSearchParams();

  if (filters?.session_id !== undefined) {
    query.set("session_id", String(filters.session_id));
  }

  if (filters?.student_id !== undefined) {
    query.set("student_id", String(filters.student_id));
  }

  if (filters?.status) {
    query.set("status", filters.status);
  }

  const path = query.toString() ? `/attendance?${query.toString()}` : "/attendance";
  const data = await apiRequest<{ attendance: unknown[] }>(path);
  return data.attendance;
}
