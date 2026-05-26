import config from '../../../../config.js';
import { Teacher } from '../../../../infrastructure/database/entities/teacher.entity.js';
import type { TeacherCodeforcesCredential } from '../../../../infrastructure/database/entities/teacher-codeforces-credential.entity.js';
import { TeacherRole, type AuthTeacher } from '../../contracts/types.js';

export function roleForTeacher(teacher: Pick<Teacher, 'username'>): TeacherRole {
  return teacher.username === config.auth.sysAdminUsername ? TeacherRole.Admin : TeacherRole.Teacher;
}

export function toAuthTeacher(teacher: Teacher, codeforcesCredential?: TeacherCodeforcesCredential | null): AuthTeacher {
  return {
    id: teacher.id,
    username: teacher.username,
    role: roleForTeacher(teacher),
    is_active: teacher.is_active,
    codeforces_handle: codeforcesCredential?.codeforces_handle ?? null,
    codeforces_api_key: codeforcesCredential?.codeforces_api_key ?? null,
    codeforces_api_secret: codeforcesCredential?.codeforces_api_secret ?? null,
    discord_username: teacher.discord_username,
    discord_user_id: teacher.discord_user_id,
    discord_verified_at: teacher.discord_verified_at,
    created_at: teacher.created_at,
  };
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
