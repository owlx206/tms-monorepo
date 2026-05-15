import { apiRequest } from "./apiClient";

export interface BackendDiscordServer {
  id: number;
  teacher_id: number;
  discord_server_id: string;
  name: string;
  synced_at: string;
  binding: {
    role: "unbound" | "class";
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
  cta_action?: "open_bot_invite" | "open_class_server" | "review_students" | null;
  cta_label?: string | null;
}

export interface DiscordSetupStatus {
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
}

export async function listDiscordServers(): Promise<BackendDiscordServer[]> {
  const data = await apiRequest<{ servers: BackendDiscordServer[] }>("/discord/servers");
  return data.servers;
}

export async function getStudentDiscordAuthorizationUrl(studentId: number): Promise<string> {
  const data = await apiRequest<{ authorize_url: string }>(
    `/students/${studentId}/discord/authorization-url`,
  );
  return data.authorize_url;
}

export async function listDiscordChannels(serverId: number): Promise<BackendDiscordChannel[]> {
  const data = await apiRequest<{ channels: BackendDiscordChannel[] }>(`/discord/servers/${serverId}/channels`);
  return data.channels;
}

export async function getDiscordBotInviteLink(): Promise<string | null> {
  const data = await apiRequest<{ invite_link: string | null }>("/discord/bot-invite-link");
  return data.invite_link;
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

export async function unbindDiscordServerByClass(classId: number): Promise<void> {
  await apiRequest<{ server: null }>(`/classes/${classId}/discord-server`, {
    method: "DELETE",
  });
}

export async function sendStudentMessages(payload: {
  content: string;
  student_ids?: number[];
  class_id?: number;
}) {
  return apiRequest<{
    recipients_total: number;
    sent: number;
    failed: number;
    failures: Array<{
      student_id: number;
      student_name: string;
      error: string;
    }>;
  }>("/discord/messages/students", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendChannelPost(payload: {
  content: string;
  server_ids: number[];
}) {
  return apiRequest<{
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
