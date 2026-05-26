import { type EntityManager, In } from 'typeorm';
import config from '../../../../../config.js';
import { SysadminDiscordBotCredential } from '../../../../../infrastructure/database/entities/sysadmin-discord-bot-credential.entity.js';
import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import {
  type TeacherAccount,
  type SysadminDiscordBotCredentialView,
} from '../../../contracts/types.js';
import { Teacher } from '../../../../../infrastructure/database/entities/teacher.entity.js';
import { TeacherCodeforcesCredential } from '../../../../../infrastructure/database/entities/teacher-codeforces-credential.entity.js';
import { discordApiUrl } from '../../../../../infrastructure/security/discord-oauth.js';
import { roleForTeacher } from '../../../application/mappers/AuthMapper.js';

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
      verification_redirect_uri: discordApiUrl('/discord/verification/callback'),
      install_redirect_uri: discordApiUrl('/discord/oauth/callback'),
      student_authorization_redirect_uri: discordApiUrl('/discord/student/callback'),
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

  async listTeacherAccounts(): Promise<TeacherAccount[]> {
    const teachers = (await this.manager.getRepository(Teacher).find({
      order: {
        created_at: 'DESC',
      },
    })).filter((teacher) => teacher.username !== config.auth.sysAdminUsername);
    const codeforcesCredentials = teachers.length > 0
      ? await this.manager.getRepository(TeacherCodeforcesCredential).findBy({
        teacher_id: In(teachers.map((teacher) => teacher.id)),
      })
      : [];
    const codeforcesCredentialByTeacherId = new Map(
      codeforcesCredentials.map((config) => [config.teacher_id, config]),
    );

    return teachers.map((teacher) => ({
      id: teacher.id,
      username: teacher.username,
      role: roleForTeacher(teacher),
      is_active: teacher.is_active,
      codeforces_handle: codeforcesCredentialByTeacherId.get(teacher.id)?.codeforces_handle ?? null,
      has_codeforces_api_key: Boolean(codeforcesCredentialByTeacherId.get(teacher.id)?.codeforces_api_key),
      has_codeforces_api_secret: Boolean(codeforcesCredentialByTeacherId.get(teacher.id)?.codeforces_api_secret),
      created_at: teacher.created_at,
    }));
  }
}
