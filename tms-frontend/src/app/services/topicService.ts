import { apiRequest } from "./apiClient";

export type BackendTopicStatus = "active";

export interface BackendTopic {
  id: number;
  teacher_id: number;
  class_id: number | null;
  title: string;
  gym_link: string;
  gym_id: string | null;
  closed_at: string | null;
  pull_interval_minutes: number;
  last_pulled_at: string | null;
  created_at: string;
  status: BackendTopicStatus;
}

export interface BackendTopicProblem {
  id: number;
  teacher_id: number;
  topic_id: number;
  problem_index: string;
  problem_name: string | null;
}

export interface BackendTopicStandingCell {
  problem_id: number;
  problem_index: string;
  problem_name: string | null;
  solved: boolean;
  penalty_minutes: number | null;
  pulled_at: string | null;
}

export interface BackendTopicStandingRow {
  student_id: number;
  student_name: string;
  solved_count: number;
  problems: BackendTopicStandingCell[];
}

export interface BackendTopicStandingMatrix {
  gym: {
    id: number;
    class_id: number;
    title: string;
    gym_link: string;
    closed_at: string | null;
    last_pulled_at: string | null;
    created_at: string;
  };
  problems: BackendTopicProblem[];
  rows: BackendTopicStandingRow[];
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

export async function listTopics(filters?: {
  classId?: number;
  class_id?: number;
  status?: BackendTopicStatus;
}): Promise<BackendTopic[]> {
  if (!filters?.classId) {
    throw new Error("classId is required to list available gyms");
  }

  const data = await apiRequest<{ gyms: BackendTopic[] }>(
    `/classes/${filters.classId}/available-gyms${buildQuery({
      status: filters?.status,
    })}`,
  );

  return data.gyms;
}

export async function bindClassTopic(
  classId: number,
  payload: { gym_id: string; pull_interval_minutes?: number },
): Promise<BackendTopic> {
  const data = await apiRequest<{ gym: BackendTopic }>(`/classes/${classId}/gyms`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return data.gym;
}

export async function unbindClassTopic(classId: number, topicId: number): Promise<BackendTopic> {
  const data = await apiRequest<{ gym: BackendTopic }>(`/classes/${classId}/gyms/${topicId}`, {
    method: "DELETE",
  });

  return data.gym;
}

export async function addTopicProblem(
  classId: number,
  topicId: number,
  payload: { problem_index: string; problem_name?: string | null },
): Promise<BackendTopicProblem> {
  const data = await apiRequest<{ problem: BackendTopicProblem }>(`/classes/${classId}/gyms/${topicId}/problems`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return data.problem;
}

export async function upsertTopicStanding(
  classId: number,
  topicId: number,
  payload: {
    student_id: number;
    problem_id: number;
    solved: boolean;
    penalty_minutes?: number | null;
    pulled_at?: string;
  },
) {
  const data = await apiRequest<{ standing: unknown }>(`/classes/${classId}/gyms/${topicId}/standings`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  return data.standing;
}

export async function getTopicStanding(classId: number, topicId: number): Promise<BackendTopicStandingMatrix> {
  return apiRequest<BackendTopicStandingMatrix>(`/classes/${classId}/gyms/${topicId}/standing`);
}
