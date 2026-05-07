import { TeacherRole } from '../../../../entities/index.js';

export type LoginInput = {
  username: string;
  password: string;
};

export type RegisterInput = {
  username: string;
  password: string;
  codeforces_handle?: string | null;
  codeforces_api_key?: string | null;
  codeforces_api_secret?: string | null;
};

export type UpdateTeacherInput = {
  username?: string;
  password?: string;
  codeforces_handle?: string | null;
  codeforces_api_key?: string | null;
  codeforces_api_secret?: string | null;
};

export type AuthTeacher = {
  id: number;
  username: string;
  role: TeacherRole;
  is_active: boolean;
  codeforces_handle: string | null;
  codeforces_api_key: string | null;
  codeforces_api_secret: string | null;
  discord_username: string | null;
  discord_user_id: string | null;
  discord_verified_at: Date | null;
  created_at: Date;
};

export type AuthTokenPayload = {
  sub: number;
  username: string;
  role: TeacherRole;
};

export type AuthTokenResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string | undefined;
  teacher: AuthTeacher;
};
