import type { AuthTeacher, TeacherRole } from "./authService";

const ACCESS_TOKEN_KEY = "tms_access_token";
const TEACHER_KEY = "tms_auth_teacher";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredTeacher(): AuthTeacher | null {
  const raw = localStorage.getItem(TEACHER_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthTeacher;
    if (!parsed || typeof parsed !== "object" || typeof parsed.role !== "string") {
      return null;
    }

    if (parsed.role !== "teacher" && parsed.role !== "admin") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function setStoredTeacher(teacher: AuthTeacher): void {
  localStorage.setItem(TEACHER_KEY, JSON.stringify(teacher));
}

export function saveAuthSession(payload: { accessToken: string; teacher: AuthTeacher }): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
  setStoredTeacher(payload.teacher);
}

export function clearAuthSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(TEACHER_KEY);
}

export function getDefaultHomePath(role: TeacherRole): string {
  return role === "admin" ? "/admin/teachers" : "/dashboard";
}
