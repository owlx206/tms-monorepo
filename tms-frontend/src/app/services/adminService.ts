import { apiRequest } from "./apiClient";
import type { TeacherRole } from "./authService";

export interface BackendTeacherAccount {
  id: number;
  username: string;
  role: TeacherRole;
  is_active: boolean;
  codeforces_handle: string | null;
  has_codeforces_api_key: boolean;
  has_codeforces_api_secret: boolean;
  created_at: string;
}

export interface BackendSysadminDiscordBotCredential {
  id: number;
  client_id: string;
  permissions: string | null;
  scopes: string | null;
  invite_link: string;
  verification_redirect_uri: string;
  install_redirect_uri: string;
  student_authorization_redirect_uri: string;
  has_bot_token: boolean;
  bot_health_status: "unknown" | "healthy" | "unhealthy";
  bot_health_message: string | null;
  bot_health_checked_at: string | null;
  has_client_secret: boolean;
  updated_at: string;
}

export async function listTeacherAccounts(): Promise<BackendTeacherAccount[]> {
  const data = await apiRequest<{ teachers: BackendTeacherAccount[] }>("/admin/teachers");
  return data.teachers;
}

export async function updateTeacherAccount(
  teacherId: number,
  payload: {
    username?: string;
    password?: string;
    is_active?: boolean;
    codeforces_handle?: string | null;
    codeforces_api_key?: string | null;
    codeforces_api_secret?: string | null;
  },
): Promise<BackendTeacherAccount> {
  const data = await apiRequest<{ teacher: BackendTeacherAccount }>(`/admin/teachers/${teacherId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return data.teacher;
}

export async function getSysadminDiscordBotCredential(): Promise<BackendSysadminDiscordBotCredential | null> {
  const data = await apiRequest<{ credential: BackendSysadminDiscordBotCredential | null }>("/admin/discord-bot");
  return data.credential;
}

export async function upsertSysadminDiscordBotCredential(payload: {
  bot_token: string;
  client_id: string;
  client_secret: string;
  permissions?: string | null;
  scopes?: string | null;
}): Promise<BackendSysadminDiscordBotCredential> {
  const data = await apiRequest<{ credential: BackendSysadminDiscordBotCredential }>("/admin/discord-bot", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  return data.credential;
}
