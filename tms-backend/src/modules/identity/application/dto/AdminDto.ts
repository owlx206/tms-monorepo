import { TeacherRole } from '../../../../entities/index.js';

export type CreateTeacherByAdminInput = {
  username: string;
  password: string;
  role: TeacherRole;
  is_active: boolean;
  codeforces_handle?: string | null;
  codeforces_api_key?: string | null;
  codeforces_api_secret?: string | null;
};

export type UpdateTeacherByAdminInput = {
  username?: string;
  password?: string;
  role?: TeacherRole;
  is_active?: boolean;
  codeforces_handle?: string | null;
  codeforces_api_key?: string | null;
  codeforces_api_secret?: string | null;
};

export type AdminTeacher = {
  id: number;
  username: string;
  role: TeacherRole;
  is_active: boolean;
  codeforces_handle: string | null;
  has_codeforces_api_key: boolean;
  has_codeforces_api_secret: boolean;
  created_at: Date;
};

export type SysadminDiscordBotCredentialInput = {
  bot_token: string;
  client_id: string;
  client_secret: string;
  permissions?: string | null;
  scopes?: string | null;
};

export type SysadminDiscordBotCredentialView = {
  id: number;
  client_id: string;
  permissions: string | null;
  scopes: string | null;
  invite_link: string;
  verification_redirect_uri: string;
  has_bot_token: boolean;
  has_client_secret: boolean;
  updated_at: Date;
};
