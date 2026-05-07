import type { SysadminDiscordBotCredentialOrmEntity } from './SysadminDiscordBotCredentialOrmEntity.js';

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
  findDefault(): Promise<SysadminDiscordBotCredentialOrmEntity | null>;
  saveDefault(input: {
    bot_token: string;
    client_id: string;
    client_secret: string;
    permissions?: string | null;
    scopes?: string | null;
  }): Promise<SysadminDiscordBotCredentialOrmEntity>;
}
