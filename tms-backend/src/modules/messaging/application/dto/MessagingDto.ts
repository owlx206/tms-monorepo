import type { DiscordMessageType } from '../../../../entities/enums.js';

export type UpsertDiscordServerInput = {
  discord_server_id: string;
  bot_token?: string | null;
  attendance_voice_channel_id?: string | null;
  notification_channel_id?: string | null;
};

export type UpsertCommunityServerInput = {
  server_id: number;
  notification_channel_id?: string | null;
  voice_channel_id?: string | null;
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
  | 'open_community_server'
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
  community_server: {
    id: number;
    teacher_id: number;
    discord_server_id: string;
    server_id: number | null;
    name: string | null;
    notification_channel_id: string | null;
    notification_channel_name: string | null;
    notification_channel_cache_id: number | null;
    voice_channel_id: string | null;
    voice_channel_name: string | null;
    voice_channel_cache_id: number | null;
  } | null;
  metrics: {
    active_students: number;
    students_with_discord_username: number;
    students_missing_discord_username: number;
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
    role: 'unbound' | 'community' | 'class';
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

export type MessageListFilters = {
  type?: DiscordMessageType;
};

export type BulkDmInput = {
  content: string;
  student_ids?: number[];
  class_id?: number;
};

export type ChannelPostInput = {
  content: string;
  server_ids: number[];
};
