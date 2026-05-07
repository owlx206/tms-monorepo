import { apiRequest } from "./apiClient";

export type BackendDiscordMessageType = "auto_notification" | "channel_post" | "bulk_dm";

export interface BackendDiscordServer {
  id: number;
  teacher_id: number;
  discord_server_id: string;
  name: string;
  synced_at: string;
  binding: {
    role: "unbound" | "community" | "class";
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
}

export interface BackendClassDiscordServerBinding {
  id: number;
  teacher_id: number;
  class_id: number;
  discord_server_id: string;
  name: string | null;
  attendance_voice_channel_id: string | null;
  notification_channel_id: string | null;
}

export interface BackendCommunityServer {
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
}

export interface BackendDiscordChannel {
  id: number;
  teacher_id: number;
  discord_server_id: string;
  discord_channel_id: string;
  name: string;
  type: "text" | "voice";
  synced_at: string;
}

export interface DiscordSetupIssue {
  code: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  cta_action?: "open_bot_invite" | "sync_servers" | "open_community_server" | "open_class_server" | "review_students" | null;
  cta_label?: string | null;
}

export interface DiscordSetupStatus {
  invite_link: string | null;
  bot_configured: boolean;
  community_server: BackendCommunityServer | null;
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
}

export interface BackendMessageListRow {
  id: number;
  teacher_id: number;
  type: BackendDiscordMessageType;
  content: string;
  server_id: number | null;
  created_at: string;
  recipients: {
    total: number;
    sent: number;
    failed: number;
  };
  failures: Array<{
    student_id: number;
    student_name: string;
    error: string;
  }>;
}

export async function listDiscordServers(): Promise<BackendDiscordServer[]> {
  const data = await apiRequest<{ servers: BackendDiscordServer[] }>("/discord/servers");
  return data.servers;
}

export async function syncDiscordServers(): Promise<{ synced_servers: number }> {
  return apiRequest<{ synced_servers: number }>("/discord/servers/sync", {
    method: "POST",
  });
}

export async function listDiscordChannels(serverId: number): Promise<BackendDiscordChannel[]> {
  const data = await apiRequest<{ channels: BackendDiscordChannel[] }>(`/discord/servers/${serverId}/channels`);
  return data.channels;
}

export async function getDiscordBotInviteLink(): Promise<string | null> {
  const data = await apiRequest<{ invite_link: string | null }>("/discord/bot-invite-link");
  return data.invite_link;
}

export async function getCommunityServer(): Promise<BackendCommunityServer | null> {
  const data = await apiRequest<{ server: BackendCommunityServer | null }>("/discord/community-server");
  return data.server;
}

export async function upsertCommunityServer(payload: {
  server_id: number;
  notification_channel_id?: string | null;
  voice_channel_id?: string | null;
}): Promise<BackendCommunityServer> {
  const data = await apiRequest<{ server: BackendCommunityServer }>("/discord/community-server/select", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  return data.server;
}

export async function deleteCommunityServer(): Promise<void> {
  await apiRequest<{ removed: boolean }>("/discord/community-server", {
    method: "DELETE",
  });
}

export async function getDiscordSetupStatus(): Promise<DiscordSetupStatus> {
  return apiRequest<DiscordSetupStatus>("/discord/setup-status");
}

export async function upsertDiscordServerByClass(
  classId: number,
  payload: {
    server_id: number;
    attendance_voice_channel_id?: string | null;
    notification_channel_id?: string | null;
  },
): Promise<BackendClassDiscordServerBinding> {
  const data = await apiRequest<{ server: BackendClassDiscordServerBinding }>(`/classes/${classId}/discord-server/select`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  return data.server;
}

export async function deleteDiscordServer(classId: number): Promise<void> {
  await apiRequest<{ removed: boolean }>(`/classes/${classId}/discord-server`, {
    method: "DELETE",
  });
}

export async function listMessages(type?: BackendDiscordMessageType): Promise<BackendMessageListRow[]> {
  const query = type ? `?type=${encodeURIComponent(type)}` : "";
  const data = await apiRequest<{ messages: BackendMessageListRow[] }>(`/discord/messages${query}`);
  return data.messages;
}

export async function sendBulkDm(payload: {
  content: string;
  student_ids?: number[];
  class_id?: number;
}) {
  return apiRequest<{
    message: {
      id: number;
      teacher_id: number;
      type: BackendDiscordMessageType;
      content: string;
      server_id: number | null;
      created_at: string;
    };
    recipients_total: number;
    sent: number;
    failed: number;
    failures: Array<{
      student_id: number;
      student_name: string;
      error: string;
    }>;
  }>("/discord/messages/bulk-dm", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendChannelPost(payload: {
  content: string;
  server_ids: number[];
}) {
  return apiRequest<{
    messages: Array<{
      id: number;
      teacher_id: number;
      type: BackendDiscordMessageType;
      content: string;
      server_id: number | null;
      created_at: string;
    }>;
    targets_total: number;
    sent: number;
    failed: number;
    failures: Array<{
      server_id: number;
      error: string;
    }>;
  }>("/discord/messages/channel-post", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
