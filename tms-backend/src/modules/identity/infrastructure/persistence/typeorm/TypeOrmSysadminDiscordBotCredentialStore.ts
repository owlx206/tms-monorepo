import { AppDataSource } from '../../../../../data-source.js';
import type { SysadminDiscordBotCredentialStore } from './SysadminDiscordBotCredentialStore.js';
import { SysadminDiscordBotCredentialOrmEntity } from './SysadminDiscordBotCredentialOrmEntity.js';

export class TypeOrmSysadminDiscordBotCredentialStore implements SysadminDiscordBotCredentialStore {
  findDefault(): Promise<SysadminDiscordBotCredentialOrmEntity | null> {
    return AppDataSource.getRepository(SysadminDiscordBotCredentialOrmEntity).findOneBy({
      singleton_key: 'default',
    });
  }

  async saveDefault(input: {
    bot_token: string;
    client_id: string;
    client_secret: string;
    permissions?: string | null;
    scopes?: string | null;
  }): Promise<SysadminDiscordBotCredentialOrmEntity> {
    const repo = AppDataSource.getRepository(SysadminDiscordBotCredentialOrmEntity);
    const existing = await this.findDefault();

    if (existing) {
      existing.bot_token = input.bot_token;
      existing.client_id = input.client_id;
      existing.client_secret = input.client_secret;
      existing.permissions = input.permissions ?? null;
      existing.scopes = input.scopes ?? null;
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
    }));
  }
}
