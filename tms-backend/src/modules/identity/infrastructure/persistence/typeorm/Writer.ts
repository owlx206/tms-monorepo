import { SysadminDiscordBotCredential } from './entities/sysadmin-discord-bot-credential.entity.js';
import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { DiscordGuildChannelCache } from '../../../../messaging/infrastructure/persistence/typeorm/entities/discord-guild-channel-cache.entity.js';
import { DiscordUserGuild } from '../../../../messaging/infrastructure/persistence/typeorm/entities/discord-user-guild.entity.js';
import { ClassDiscordBinding } from '../../../../messaging/infrastructure/persistence/typeorm/entities/class-discord-binding.entity.js';
import { Enrollment } from '../../../../enrollment/infrastructure/persistence/typeorm/entities/enrollment.entity.js';
import { Student } from '../../../../enrollment/infrastructure/persistence/typeorm/entities/student.entity.js';
import { Teacher } from './entities/teacher.entity.js';
import { TopicBotConfig } from '../../../../topic/infrastructure/persistence/typeorm/entities/topic-bot-config.entity.js';

// SysadminDiscordBotCredentialStore.ts
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

// TypeOrmDiscordUserGuildStore.ts
export class TypeOrmDiscordUserGuildStore {
  findAnyByDiscordGuildId(discordGuildId: string): Promise<DiscordUserGuild | null> {
    return AppDataSource.getRepository(DiscordUserGuild).findOneBy({
      discord_guild_id: discordGuildId,
    });
  }

  findByOwnerAndDiscordGuildId(
    discordUserId: string,
    discordGuildId: string,
  ): Promise<DiscordUserGuild | null> {
    return AppDataSource.getRepository(DiscordUserGuild).findOneBy({
      discord_user_id: discordUserId,
      discord_guild_id: discordGuildId,
    });
  }

  createUserGuild(values: Partial<DiscordUserGuild>): DiscordUserGuild {
    return AppDataSource.getRepository(DiscordUserGuild).create(values);
  }

  saveUserGuild(userGuild: DiscordUserGuild): Promise<DiscordUserGuild> {
    return AppDataSource.getRepository(DiscordUserGuild).save(userGuild);
  }

  async replaceChannelCache(
    discordUserId: string,
    discordGuildId: string,
    channels: Array<{ discord_channel_id: string; name: string; type: 'text' | 'voice' }>,
  ): Promise<DiscordGuildChannelCache[]> {
    const repo = AppDataSource.getRepository(DiscordGuildChannelCache);
    await repo.delete({
      discord_user_id: discordUserId,
      discord_guild_id: discordGuildId,
    });

    if (channels.length === 0) {
      return [];
    }

    return repo.save(channels.map((channel) => repo.create({
      discord_user_id: discordUserId,
      discord_guild_id: discordGuildId,
      discord_channel_id: channel.discord_channel_id,
      name: channel.name,
      type: channel.type,
      synced_at: new Date(),
    })));
  }
}

// TypeOrmStudentDiscordIdentityStore.ts
export type StudentActiveClassDiscordBinding = {
  student_id: number;
  active_class_id: number;
  discord_guild_id: string;
};

export class TypeOrmStudentDiscordIdentityStore {
  async studentExists(teacherId: number, studentId: number): Promise<boolean> {
    return AppDataSource.getRepository(Student).existsBy({
      teacher_id: teacherId,
      id: studentId,
    });
  }

  async updateStudentDiscordAuthorization(input: {
    teacherId: number;
    studentId: number;
    discordUserId: string;
    discordUsername: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    authorizedAt: Date;
  }): Promise<void> {
    await AppDataSource.getRepository(Student).update(
      {
        teacher_id: input.teacherId,
        id: input.studentId,
      },
      {
        discord_user_id: input.discordUserId,
        discord_username: input.discordUsername,
        discord_access_token: input.accessToken,
        discord_refresh_token: input.refreshToken,
        discord_token_expires_at: input.tokenExpiresAt,
        discord_authorized_at: input.authorizedAt,
      },
    );
  }

  async getActiveClassDiscordBinding(
    teacherId: number,
    studentId: number,
  ): Promise<StudentActiveClassDiscordBinding | null> {
    const row = await AppDataSource.getRepository(Student)
      .createQueryBuilder('student')
      .innerJoin(
        Enrollment,
        'enrollment',
        'enrollment.teacher_id = student.teacher_id AND enrollment.student_id = student.id AND enrollment.unenrolled_at IS NULL',
      )
      .innerJoin(
        ClassDiscordBinding,
        'discord_guild',
        'discord_guild.teacher_id = student.teacher_id AND discord_guild.class_id = enrollment.class_id',
      )
      .select('student.id', 'student_id')
      .addSelect('enrollment.class_id', 'active_class_id')
      .addSelect('discord_guild.discord_guild_id', 'discord_guild_id')
      .where('student.teacher_id = :teacherId', { teacherId })
      .andWhere('student.id = :studentId', { studentId })
      .getRawOne<{
        student_id: number | string;
        active_class_id: number | string;
        discord_guild_id: string;
      }>();

    if (!row) {
      return null;
    }

    return {
      student_id: Number(row.student_id),
      active_class_id: Number(row.active_class_id),
      discord_guild_id: row.discord_guild_id,
    };
  }
}

// TypeOrmSysadminDiscordBotCredentialStore.ts
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

// TypeOrmTeacherWriter.ts
export class TypeOrmTeacherWriter {
  create(input: Partial<Teacher>): Teacher {
    return AppDataSource.getRepository(Teacher).create(input);
  }

  save(teacher: Teacher): Promise<Teacher> {
    return AppDataSource.getRepository(Teacher).save(teacher);
  }

  findById(teacherId: number): Promise<Teacher | null> {
    return AppDataSource.getRepository(Teacher).findOneBy({ id: teacherId });
  }

  findByUsername(username: string): Promise<Teacher | null> {
    return AppDataSource.getRepository(Teacher).findOneBy({ username });
  }

  findTopicBotConfig(teacherId: number): Promise<TopicBotConfig | null> {
    return AppDataSource.getRepository(TopicBotConfig).findOneBy({ teacher_id: teacherId });
  }

  async saveTopicBotConfig(
    teacherId: number,
    input: {
      codeforces_api_key?: string | null;
      codeforces_api_secret?: string | null;
    },
  ): Promise<TopicBotConfig | null> {
    const hasApiKeyInput = input.codeforces_api_key !== undefined;
    const hasApiSecretInput = input.codeforces_api_secret !== undefined;
    if (!hasApiKeyInput && !hasApiSecretInput) {
      return this.findTopicBotConfig(teacherId);
    }

    const repo = AppDataSource.getRepository(TopicBotConfig);
    const existing = await repo.findOneBy({ teacher_id: teacherId });
    const config = existing ?? repo.create({ teacher_id: teacherId });

    if (hasApiKeyInput) {
      config.codeforces_api_key = input.codeforces_api_key?.trim() || null;
    }

    if (hasApiSecretInput) {
      config.codeforces_api_secret = input.codeforces_api_secret?.trim() || null;
    }

    config.updated_at = new Date();
    return repo.save(config);
  }

  async clearDiscordWorkspaceData(teacherId: number, discordUserId: string | null): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      await manager.getRepository(ClassDiscordBinding).delete({ teacher_id: teacherId });

      if (discordUserId) {
        await manager.getRepository(DiscordGuildChannelCache).delete({ discord_user_id: discordUserId });
        await manager.getRepository(DiscordUserGuild).delete({ discord_user_id: discordUserId });
      }
    });
  }
}
