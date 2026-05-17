import type { SysadminDiscordBotCredential } from '../../../../../entities/discord-bot-credential.entity.js';

export type SysadminDiscordBotCredentialRecord = {
  id: number;
  client_id: string;
  client_secret: string;
  bot_token: string;
  permissions: string | null;
  scopes: string | null;
  created_at: Date;
  updated_at: Date;
};

export interface SysadminDiscordBotCredentialStore {
  findDefault(): Promise<SysadminDiscordBotCredential | null>;
  saveDefault(input: {
    bot_token: string;
    client_id: string;
    client_secret: string;
    permissions?: string | null;
    scopes?: string | null;
  }): Promise<SysadminDiscordBotCredential>;
}
