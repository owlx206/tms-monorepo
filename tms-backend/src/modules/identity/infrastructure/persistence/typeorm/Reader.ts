import config from '../../../../../config.js';
import { type EntityManager, In } from 'typeorm';
import { SysadminDiscordBotCredential } from './entities/sysadmin-discord-bot-credential.entity.js';
import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { type AdminTeacher, type SysadminDiscordBotCredentialView } from '../../../contracts/types.js';
import { Teacher } from './entities/teacher.entity.js';
import { TopicBotConfig } from '../../../../topic/infrastructure/persistence/typeorm/entities/topic-bot-config.entity.js';

// TypeOrmSysadminDiscordBotCredentialReader.ts
function buildInviteLink(input: {
  clientId: string;
  permissions: string | null;
  scopes: string | null;
}): string {
  const search = new URLSearchParams({
    client_id: input.clientId,
    scope: input.scopes?.trim() || 'bot applications.commands',
  });

  if (input.permissions?.trim()) {
    search.set('permissions', input.permissions.trim());
  }

  return `https://discord.com/oauth2/authorize?${search.toString()}`;
}

export class TypeOrmSysadminDiscordBotCredentialReader {
  constructor(private readonly manager: EntityManager = AppDataSource.manager) {}

  async getDefaultView(): Promise<SysadminDiscordBotCredentialView | null> {
    const credential = await this.manager.getRepository(SysadminDiscordBotCredential).findOneBy({
      singleton_key: 'default',
    });

    if (!credential) {
      return null;
    }

    return {
      id: credential.id,
      client_id: credential.client_id,
      permissions: credential.permissions,
      scopes: credential.scopes,
      invite_link: buildInviteLink({
        clientId: credential.client_id,
        permissions: credential.permissions,
        scopes: credential.scopes,
      }),
      verification_redirect_uri: `${config.backendPublicUrl}${config.apiPrefix}/discord/verification/callback`,
      has_bot_token: Boolean(credential.bot_token),
      bot_health_status: credential.bot_health_status,
      bot_health_message: credential.bot_health_message,
      bot_health_checked_at: credential.bot_health_checked_at,
      has_client_secret: Boolean(credential.client_secret),
      updated_at: credential.updated_at,
    };
  }
}

// TypeOrmTeacherReader.ts
export class TypeOrmTeacherReader {
  constructor(private readonly manager: EntityManager = AppDataSource.manager) {}

  async listAdminTeachers(): Promise<AdminTeacher[]> {
    const teachers = await this.manager.getRepository(Teacher).find({
      order: {
        created_at: 'DESC',
      },
    });
    const topicBotConfigs = teachers.length > 0
      ? await this.manager.getRepository(TopicBotConfig).findBy({
        teacher_id: In(teachers.map((teacher) => teacher.id)),
      })
      : [];
    const topicBotConfigByTeacherId = new Map(
      topicBotConfigs.map((config) => [config.teacher_id, config]),
    );

    return teachers.map((teacher) => ({
      id: teacher.id,
      username: teacher.username,
      role: teacher.role,
      is_active: teacher.is_active,
      has_codeforces_api_key: Boolean(topicBotConfigByTeacherId.get(teacher.id)?.codeforces_api_key),
      has_codeforces_api_secret: Boolean(topicBotConfigByTeacherId.get(teacher.id)?.codeforces_api_secret),
      created_at: teacher.created_at,
    }));
  }
}
