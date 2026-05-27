export enum TeacherRole {
  Admin = 'admin',
  Teacher = 'teacher',
}

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
};

export type AuthTokenResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string | undefined;
  teacher: AuthTeacher;
};

export type UpdateTeacherAccountInput = {
  username?: string;
  password?: string;
  is_active?: boolean;
  codeforces_handle?: string | null;
  codeforces_api_key?: string | null;
  codeforces_api_secret?: string | null;
};

export type TeacherAccount = {
  id: number;
  username: string;
  role: TeacherRole;
  is_active: boolean;
  codeforces_handle: string | null;
  has_codeforces_api_key: boolean;
  has_codeforces_api_secret: boolean;
  created_at: Date;
};

export type DiscordBotCredentialInput = {
  bot_token: string;
  client_id: string;
  client_secret: string;
  permissions?: string | null;
  scopes?: string | null;
};

export type DiscordBotCredentialView = {
  id: number;
  client_id: string;
  permissions: string | null;
  scopes: string | null;
  invite_link: string;
  verification_redirect_uri: string;
  install_redirect_uri: string;
  student_authorization_redirect_uri: string;
  has_bot_token: boolean;
  bot_health_status: 'unknown' | 'healthy' | 'unhealthy';
  bot_health_message: string | null;
  bot_health_checked_at: Date | null;
  has_client_secret: boolean;
  updated_at: Date;
};

export type CompleteTeacherDiscordVerificationInput = {
  code?: string;
  state?: string;
  error?: string;
};

export type DiscordTokenPayload = {
  access_token?: string;
  token_type?: string;
};

export type DiscordUserPayload = {
  id?: string;
  username?: string;
};
