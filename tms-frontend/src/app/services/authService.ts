import { apiRequest } from "./apiClient";

export type TeacherRole = "sysadmin" | "teacher";

export interface AuthTeacher {
  id: number;
  username: string;
  role: TeacherRole;
  is_active: boolean;
  codeforces_handle: string | null;
  codeforces_api_key: string | null;
  codeforces_api_secret: string | null;
  discord_username: string | null;
  discord_user_id: string | null;
  discord_verified_at: string | null;
  created_at: string;
}

type AuthResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn?: string;
  teacher: AuthTeacher;
};

export async function login(payload: {
  username: string;
  password: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/login", {
    withAuth: false,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function register(payload: {
  username: string;
  password: string;
  codeforces_handle?: string | null;
  codeforces_api_key?: string | null;
  codeforces_api_secret?: string | null;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/register", {
    withAuth: false,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMe(): Promise<AuthTeacher> {
  const data = await apiRequest<{ teacher: AuthTeacher }>("/me");
  return data.teacher;
}

export async function updateMe(payload: {
  username?: string;
  password?: string;
  codeforces_handle?: string | null;
  codeforces_api_key?: string | null;
  codeforces_api_secret?: string | null;
}): Promise<AuthTeacher> {
  const data = await apiRequest<{ teacher: AuthTeacher }>("/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return data.teacher;
}

export async function getDiscordVerificationAuthorizeUrl(): Promise<string> {
  const data = await apiRequest<{ authorize_url: string }>("/me/discord/verification/start");
  return data.authorize_url;
}
