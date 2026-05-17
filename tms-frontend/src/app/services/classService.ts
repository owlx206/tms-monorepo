import { apiRequest } from "./apiClient";

export type BackendClassStatus = "active" | "archived";
export type BackendSessionStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface BackendClass {
  id: number;
  teacher_id: number;
  name: string;
  fee_per_session: string;
  status: BackendClassStatus;
  created_at: string;
  archived_at: string | null;
}

export interface BackendClassSchedule {
  id: number;
  teacher_id: number;
  class_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface BackendClassDiscordGuildBinding {
  id: number;
  teacher_id: number;
  class_id: number;
  discord_guild_id: string;
  name: string | null;
  attendance_voice_channel_id: string | null;
  notification_channel_id: string | null;
}

export interface BackendClassDetailStudent {
  id: number;
  teacher_id: number;
  full_name: string;
  codeforces_handle: string | null;
  discord_username: string | null;
  discord_user_id: string | null;
  phone: string | null;
  status: string;
  enrolled_at: string;
}

export interface BackendClassDetailTopic {
  id: number;
  teacher_id: number;
  class_id: number;
  title: string;
  gym_link: string;
  gym_id: string | null;
  closed_at: string | null;
  pull_interval_minutes: number;
  last_pulled_at: string | null;
  created_at: string;
  status: "active" | "closed";
  problems: Array<{
    id: number;
    teacher_id: number;
    topic_id: number;
    problem_index: string;
    problem_name: string | null;
  }>;
  progress: {
    total_students: number;
    total_problems: number;
    solved_count: number;
    completed_students: number;
    average_solved: number;
  };
}

export interface BackendClassDetails {
  class: BackendClass;
  schedules: BackendClassSchedule[];
  discord_guild: BackendClassDiscordGuildBinding | null;
  active_students: BackendClassDetailStudent[];
  topics: BackendClassDetailTopic[];
  is_ready: boolean;
}

export interface BackendSession {
  id: number;
  teacher_id: number;
  class_id: number;
  scheduled_at: string;
  end_time: string | null;
  status: BackendSessionStatus;
  is_manual: boolean;
  created_at: string;
  cancelled_at: string | null;
  cancelled_by: number | null;
}

type RawBackendClass = Omit<BackendClass, "status"> & {
  status: string;
};

type RawBackendSession = Omit<BackendSession, "status"> & {
  status: string;
};

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

function normalizeClassStatus(status: string): BackendClassStatus {
  return status.toLowerCase() === "archived" ? "archived" : "active";
}

function normalizeSessionStatus(status: string): BackendSessionStatus {
  const normalized = status.toLowerCase();

  if (normalized === "completed") {
    return "completed";
  }

  if (normalized === "in_progress") {
    return "in_progress";
  }

  if (normalized === "cancelled") {
    return "cancelled";
  }

  return "scheduled";
}

function normalizeBackendClass(classItem: RawBackendClass): BackendClass {
  return {
    ...classItem,
    status: normalizeClassStatus(classItem.status),
  };
}

function normalizeBackendSession(session: RawBackendSession): BackendSession {
  return {
    ...session,
    status: normalizeSessionStatus(session.status),
  };
}

export async function listClasses(
  status?: BackendClassStatus,
  options?: { readyOnly?: boolean },
): Promise<BackendClass[]> {
  const data = await apiRequest<{ classes: RawBackendClass[] }>(
    `/classes${buildQuery({ status, ready_only: options?.readyOnly ? "true" : undefined })}`,
  );
  return data.classes.map(normalizeBackendClass);
}

export async function createClass(payload: {
  name: string;
  fee_per_session: number;
  schedules: {
    day_of_week: number;
    start_time: string;
    end_time: string;
  }[];
}): Promise<BackendClass> {
  const data = await apiRequest<{ class: RawBackendClass }>("/classes", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeBackendClass(data.class);
}

export async function updateClass(
  classId: number,
  payload: {
    name?: string;
    fee_per_session?: number;
    schedules?: {
      day_of_week: number;
      start_time: string;
      end_time: string;
    }[];
  },
): Promise<BackendClass> {
  const data = await apiRequest<{ class: RawBackendClass }>(`/classes/${classId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return normalizeBackendClass(data.class);
}

export async function archiveClass(classId: number): Promise<BackendClass> {
  const data = await apiRequest<{ class: RawBackendClass }>(`/classes/${classId}/archive`, {
    method: "POST",
  });

  return normalizeBackendClass(data.class);
}

export async function listClassSchedules(classId: number): Promise<BackendClassSchedule[]> {
  const data = await apiRequest<{ schedules: BackendClassSchedule[] }>(`/classes/${classId}/schedules`);
  return data.schedules;
}

export async function getClassDetails(classId: number): Promise<BackendClassDetails> {
  const data = await apiRequest<{
    details: Omit<BackendClassDetails, "class"> & { class: RawBackendClass };
  }>(`/classes/${classId}/details`);

  return {
    ...data.details,
    class: normalizeBackendClass(data.details.class),
  };
}

export async function listSessions(filters?: {
  class_id?: number;
  status?: BackendSessionStatus;
  from?: string;
  to?: string;
}): Promise<BackendSession[]> {
  const data = await apiRequest<{ sessions: RawBackendSession[] }>(
    `/sessions${buildQuery({ class_id: filters?.class_id, status: filters?.status, from: filters?.from, to: filters?.to })}`,
  );

  return data.sessions.map(normalizeBackendSession);
}

export async function createManualSession(
  classId: number,
  payload: {
    scheduled_date: string;
    start_time: string;
    end_time: string;
  },
): Promise<BackendSession> {
  const data = await apiRequest<{ session: RawBackendSession }>(`/classes/${classId}/sessions/manual`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeBackendSession(data.session);
}

export async function cancelSession(sessionId: number): Promise<BackendSession> {
  const data = await apiRequest<{ session: RawBackendSession }>(`/sessions/${sessionId}/cancel`, {
    method: "POST",
  });

  return normalizeBackendSession(data.session);
}
