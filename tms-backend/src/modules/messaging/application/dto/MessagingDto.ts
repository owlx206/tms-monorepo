export type UpsertDiscordServerInput = {
  discord_server_id: string;
  bot_token?: string | null;
  attendance_voice_channel_id?: string | null;
  notification_channel_id?: string | null;
};

export type SelectClassDiscordServerInput = {
  server_id: number;
  notification_channel_id?: string | null;
  attendance_voice_channel_id?: string | null;
};

export type DiscordSetupIssueSeverity = 'critical' | 'warning' | 'info';
export type DiscordSetupAction =
  | 'open_bot_invite'
  | 'sync_servers'
  | 'sync_membership'
  | 'open_class_server'
  | 'review_students';

export type DiscordSetupIssue = {
  code: string;
  severity: DiscordSetupIssueSeverity;
  title: string;
  description: string;
  cta_action?: DiscordSetupAction | null;
  cta_label?: string | null;
};

export type DiscordSetupStatus = {
  invite_link: string | null;
  bot_configured: boolean;
  metrics: {
    active_students: number;
    students_with_discord_username: number;
    students_missing_discord_username: number;
    students_with_discord_authorization: number;
    students_missing_discord_authorization: number;
    active_classes: number;
    configured_class_servers: number;
    classes_missing_server: number;
    synced_servers: number;
  };
  missing_class_server_names: string[];
  issues: DiscordSetupIssue[];
};

export type TeacherDiscordServerOption = {
  id: number;
  teacher_id: number;
  discord_server_id: string;
  name: string;
  synced_at: Date;
  binding: {
    role: 'unbound' | 'class';
    server_binding_id: number | null;
    class_id: number | null;
    class_name: string | null;
    notification_channel_id: string | null;
    notification_channel_name: string | null;
    notification_channel_cache_id: number | null;
    attendance_voice_channel_id: string | null;
    attendance_voice_channel_name: string | null;
    attendance_voice_channel_cache_id: number | null;
  };
};

export type TeacherDiscordChannelOption = {
  id: number;
  teacher_id: number;
  discord_server_id: string;
  discord_channel_id: string;
  name: string;
  type: 'text' | 'voice';
  synced_at: Date;
};

export type StudentMessageInput = {
  content: string;
  student_ids?: number[];
  class_id?: number;
};

export type ChannelPostInput = {
  content: string;
  server_ids: number[];
};

export type DiscordMembershipSyncFailure = {
  student_id: number | null;
  student_name: string | null;
  class_id: number | null;
  class_name: string | null;
  code: string;
  message: string;
};

export type DiscordMembershipSyncResult = {
  synced_servers: number;
  total_students: number;
  resolved_students: number;
  discord_user_ids_updated: number;
  already_in_class_server: number;
  joined_class_server: number;
  kicked_from_class_server: number;
  failed: number;
  failures: DiscordMembershipSyncFailure[];
};
