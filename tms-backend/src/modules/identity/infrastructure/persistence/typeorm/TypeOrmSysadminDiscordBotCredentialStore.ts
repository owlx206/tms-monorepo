import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import type { SysadminDiscordBotCredentialStore } from './SysadminDiscordBotCredentialStore.js';
import { SysadminDiscordBotCredential } from '../../../../../entities/discord-bot-credential.entity.js';

export class TypeOrmSysadminDiscordBotCredentialStore implements SysadminDiscordBotCredentialStore {
  findDefault(): Promise<SysadminDiscordBotCredential | null> {
    return AppDataSource.getRepository(SysadminDiscordBotCredential).findOneBy({
      singleton_key: 'default',
    });
  }

  async saveDefault(input: {
    bot_token: string;
    client_id: string;
    client_secret: string;
    permissions?: string | null;
    scopes?: string | null;
  }): Promise<SysadminDiscordBotCredential> {
    const repo = AppDataSource.getRepository(SysadminDiscordBotCredential);
    const existing = await this.findDefault();

    if (existing) {
      existing.bot_token = input.bot_token;
      existing.client_id = input.client_id;
      existing.client_secret = input.client_secret;
      existing.permissions = input.permissions ?? null;
      existing.scopes = input.scopes ?? null;
      existing.bot_health_status = 'unknown';
      existing.bot_health_message = 'Bot token health has not been checked after the latest update.';
      existing.bot_health_checked_at = null;
      existing.updated_at = new Date();
      return repo.save(existing);
    }

    return repo.save(repo.create({
      singleton_key: 'default',
      bot_token: input.bot_token,
      client_id: input.client_id,
      client_secret: input.client_secret,
      permissions: input.permissions ?? null,
      scopes: input.scopes ?? null,
      bot_health_status: 'unknown',
      bot_health_message: 'Bot token health has not been checked yet.',
      bot_health_checked_at: null,
    }));
  }
}
