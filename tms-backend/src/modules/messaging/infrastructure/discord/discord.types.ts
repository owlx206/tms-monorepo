export type DiscordGuildMetadata = {
  id: string;
  name: string;
};

export type DiscordChannelOwnershipCheck = {
  channelId: string;
  guildId: string;
  fieldName: string;
};

export type DiscordGuildChannel = {
  id: string;
  name: string;
  type: 'text' | 'voice';
};

export type DirectMessagePayload = {
  recipientUserId: string;
  content: string;
};

export type ChannelMessagePayload = {
  channelId: string;
  content: string;
};

export type DiscordServerContext = {
  id: number;
  teacher_id: number;
  class_id: number | null;
  discord_server_id: string;
  name: string | null;
  bot_token: string | null;
  attendance_voice_channel_id: string | null;
  notification_channel_id: string | null;
};

export type ResolvedDiscordRecipient = {
  userId: string | null;
  error?: string | null;
};
