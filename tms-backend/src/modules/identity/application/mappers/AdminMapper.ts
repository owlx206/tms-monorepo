import { Teacher } from '../../../../infrastructure/database/entities/teacher.entity.js';
import type { TeacherCodeforcesCredential } from '../../../../infrastructure/database/entities/teacher-codeforces-credential.entity.js';
import type { AdminTeacher } from '../../contracts/types.js';
import { roleForTeacher } from './AuthMapper.js';

export function toAdminTeacher(teacher: Teacher, codeforcesCredential?: TeacherCodeforcesCredential | null): AdminTeacher {
  return {
    id: teacher.id,
    username: teacher.username,
    role: roleForTeacher(teacher),
    is_active: teacher.is_active,
    codeforces_handle: codeforcesCredential?.codeforces_handle ?? null,
    has_codeforces_api_key: Boolean(codeforcesCredential?.codeforces_api_key),
    has_codeforces_api_secret: Boolean(codeforcesCredential?.codeforces_api_secret),
    created_at: teacher.created_at,
  };
}
