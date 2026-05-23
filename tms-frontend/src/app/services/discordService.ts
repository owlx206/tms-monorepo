import { apiRequest } from "./apiClient";

export interface BackendClassDiscordBinding {
  id: number;
  teacher_id: number;
  discord_guild_id: string;
  name: string | null;
  synced_at: string | null;
  binding: {
    role: "unbound" | "class";
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
}

export interface BackendClassDiscordGuildBinding {
  id: number;
  teacher_id: number;
  class_id: number;
  discord_guild_id: string;
  name: string | null;
  attendance_voice_channel_id: string | null;
  notification_channel_id: string | null;
}

export interface BackendDiscordChannel {
  id: number;
  teacher_id: number;
  discord_guild_id: string;
  discord_channel_id: string;
  name: string;
  type: "text" | "voice";
  synced_at: string;
}

export async function listDiscordGuilds(): Promise<BackendClassDiscordBinding[]> {
  const data = await apiRequest<{ guilds: BackendClassDiscordBinding[] }>("/discord/guilds");
  return data.guilds;
}

export async function getStudentDiscordAuthorizationUrl(studentId: number): Promise<string> {
  const data = await apiRequest<{ authorize_url: string }>(
    `/students/${studentId}/discord/authorization-url`,
  );
  return data.authorize_url;
}

export async function listDiscordGuildChannels(guildId: number): Promise<BackendDiscordChannel[]> {
  const data = await apiRequest<{ channels: BackendDiscordChannel[] }>(`/discord/guilds/${guildId}/channels`);
  return data.channels;
}

export async function getDiscordBotInviteLink(): Promise<string | null> {
  const data = await apiRequest<{ invite_link: string | null }>("/discord/bot-invite-link");
  return data.invite_link;
}

export async function upsertDiscordGuildByClass(
  classId: number,
  payload: {
    guild_id: number;
    attendance_voice_channel_id?: string | null;
    notification_channel_id?: string | null;
  },
): Promise<BackendClassDiscordGuildBinding> {
  const data = await apiRequest<{ binding: BackendClassDiscordGuildBinding }>(`/classes/${classId}/discord-guild/select`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  return data.binding;
}

export async function unbindDiscordGuildByClass(classId: number): Promise<void> {
  await apiRequest<{ binding: null }>(`/classes/${classId}/discord-guild`, {
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
  }>("/students/discord/messages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendChannelPost(payload: {
  content: string;
  guild_ids: number[];
}) {
  return apiRequest<{
    targets_total: number;
    sent: number;
    failed: number;
    failures: Array<{
      guild_id: number;
      error: string;
    }>;
  }>("/discord/messages/channel-post", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
