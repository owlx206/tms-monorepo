export type UpsertDiscordGuildInput = {
  discord_guild_id: string;
  bot_token?: string | null;
  attendance_voice_channel_id?: string | null;
  notification_channel_id?: string | null;
};

export type SelectClassDiscordGuildInput = {
  guild_id: number;
  notification_channel_id?: string | null;
  attendance_voice_channel_id?: string | null;
};

export type DiscordSetupIssueSeverity = 'critical' | 'warning' | 'info';
export type DiscordSetupAction =
  | 'open_bot_invite'
  | 'sync_guilds'
  | 'sync_membership'
  | 'open_class_guild'
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
    configured_class_guilds: number;
    classes_missing_guild: number;
    synced_guilds: number;
  };
  missing_class_guild_names: string[];
  issues: DiscordSetupIssue[];
};

export type TeacherDiscordGuildOption = {
  id: number;
  teacher_id: number;
  discord_guild_id: string;
  name: string;
  synced_at: Date;
  binding: {
    role: 'unbound' | 'class';
    guild_binding_id: number | null;
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
  discord_guild_id: string;
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
  guild_ids: number[];
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
  synced_guilds: number;
  total_students: number;
  resolved_students: number;
  discord_user_ids_updated: number;
  already_in_class_guild: number;
  joined_class_guild: number;
  kicked_from_class_guild: number;
  failed: number;
  failures: DiscordMembershipSyncFailure[];
};

export type TeacherDiscordGuildRow = {
  id: number;
  teacher_id: number;
  discord_guild_id: string;
  name: string;
  synced_at: Date;
  binding_guild_id: number | null;
  binding_role: 'unbound' | 'class';
  binding_class_id: number | null;
  binding_class_name: string | null;
  binding_notification_channel_id: string | null;
  binding_notification_channel_name: string | null;
  binding_notification_channel_cache_id: number | null;
  binding_attendance_voice_channel_id: string | null;
  binding_attendance_voice_channel_name: string | null;
  binding_attendance_voice_channel_cache_id: number | null;
};

export type TeacherDiscordGuildReader = {
  listTeacherDiscordGuilds(teacherId: number): Promise<TeacherDiscordGuildRow[]>;
};

export type TeacherDiscordChannelReader = {
  listTeacherDiscordChannelsForGuild(
    teacherId: number,
    discordGuildId: string,
  ): Promise<TeacherDiscordChannelOption[]>;
};

export type DeliveryStatus = 'sent' | 'failed';
