import { In } from 'typeorm';

import { SysadminDiscordBotCredential } from '../../../../../infrastructure/database/entities/sysadmin-discord-bot-credential.entity.js';
import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { DiscordGuildChannelCache } from '../../../../../infrastructure/external/discord/cache/entities/discord-guild-channel-cache.entity.js';
import { DiscordUserGuild } from '../../../../../infrastructure/external/discord/cache/entities/discord-user-guild.entity.js';
import { ClassDiscordBinding } from '../../../../../infrastructure/database/entities/discord/class-discord-binding.entity.js';
import { Enrollment } from '../../../../../infrastructure/database/entities/enrollment.entity.js';
import { Student } from '../../../../../infrastructure/database/entities/student.entity.js';
import { Teacher } from '../../../../../infrastructure/database/entities/teacher.entity.js';
import { TeacherCodeforcesCredential } from '../../../../../infrastructure/database/entities/teacher-codeforces-credential.entity.js';
import { StudentDiscordCredential } from '../../../../../infrastructure/database/entities/student-discord-credential.entity.js';

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

export function findDefaultSysadminDiscordBotCredential(): Promise<SysadminDiscordBotCredential | null> {
  return AppDataSource.getRepository(SysadminDiscordBotCredential).findOneBy({
    singleton_key: 'default',
  });
}

export async function updateDefaultSysadminDiscordBotHealth(input: {
  status: 'unknown' | 'healthy' | 'unhealthy';
  message: string;
  checkedAt: Date;
}): Promise<void> {
  await AppDataSource.getRepository(SysadminDiscordBotCredential).update(
    { singleton_key: 'default' },
    {
      bot_health_status: input.status,
      bot_health_message: input.message,
      bot_health_checked_at: input.checkedAt,
    },
  );
}

export async function listTeacherIdsWithDiscordUserId(): Promise<number[]> {
  const teachers = await AppDataSource.getRepository(Teacher)
    .createQueryBuilder('teacher')
    .select('teacher.id', 'id')
    .where('teacher.discord_user_id IS NOT NULL')
    .andWhere("LEN(TRIM(teacher.discord_user_id)) > 0")
    .getRawMany<{ id: number }>();

  return teachers.map((teacher) => Number(teacher.id));
}

export async function listTeacherIdsForCodeforcesSync(): Promise<number[]> {
  const teachers = await AppDataSource.getRepository(Teacher).find({
    select: { id: true },
  });

  return teachers.map((teacher) => teacher.id);
}

export async function findTeacherCodeforcesSyncConfig(teacherId: number): Promise<{
  codeforces_handle: string | null;
  codeforces_api_key: string | null;
  codeforces_api_secret: string | null;
} | null> {
  return AppDataSource.getRepository(TeacherCodeforcesCredential).findOneBy({
    teacher_id: teacherId,
  });
}

export async function findTeacherDiscordUserId(teacherId: number): Promise<string | null> {
  const teacher = await AppDataSource.getRepository(Teacher).findOne({
    where: { id: teacherId },
    select: { id: true, discord_user_id: true },
  });

  return teacher?.discord_user_id?.trim() || null;
}

export async function listStudentDiscordIdentities(studentIds: number[]): Promise<Array<{
  student_id: number;
  discord_user_id: string | null;
  discord_username: string | null;
}>> {
  if (studentIds.length === 0) {
    return [];
  }

  const credentials = await AppDataSource.getRepository(StudentDiscordCredential).findBy({
    student_id: In(studentIds),
  });

  return credentials.map((credential) => ({
    student_id: credential.student_id,
    discord_user_id: credential.discord_user_id,
    discord_username: credential.discord_username,
  }));
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
    const student = await AppDataSource.getRepository(Student).findOneBy({
      teacher_id: input.teacherId,
      id: input.studentId,
    });
    if (!student) {
      return;
    }

    const repo = AppDataSource.getRepository(StudentDiscordCredential);
    const existing = await repo.findOneBy({ student_id: input.studentId });

    await repo.save(repo.create({
      id: existing?.id,
      student_id: input.studentId,
      discord_user_id: input.discordUserId,
      discord_username: input.discordUsername,
      discord_access_token: input.accessToken,
      discord_refresh_token: input.refreshToken,
      discord_token_expires_at: input.tokenExpiresAt,
      discord_authorized_at: input.authorizedAt,
    }));
  }

  async updateStudentDiscordTokens(input: {
    teacherId: number;
    studentId: number;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
  }): Promise<void> {
    const student = await AppDataSource.getRepository(Student).findOneBy({
      teacher_id: input.teacherId,
      id: input.studentId,
    });
    if (!student) {
      return;
    }

    await AppDataSource.getRepository(StudentDiscordCredential).update(
      { student_id: input.studentId },
      {
        discord_access_token: input.accessToken,
        discord_refresh_token: input.refreshToken,
        discord_token_expires_at: input.tokenExpiresAt,
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

  findTeacherCodeforcesCredential(teacherId: number): Promise<TeacherCodeforcesCredential | null> {
    return AppDataSource.getRepository(TeacherCodeforcesCredential).findOneBy({ teacher_id: teacherId });
  }

  async saveTeacherCodeforcesCredential(
    teacherId: number,
    input: {
      codeforces_handle?: string | null;
      codeforces_api_key?: string | null;
      codeforces_api_secret?: string | null;
    },
  ): Promise<TeacherCodeforcesCredential | null> {
    const hasHandleInput = input.codeforces_handle !== undefined;
    const hasApiKeyInput = input.codeforces_api_key !== undefined;
    const hasApiSecretInput = input.codeforces_api_secret !== undefined;
    if (!hasHandleInput && !hasApiKeyInput && !hasApiSecretInput) {
      return this.findTeacherCodeforcesCredential(teacherId);
    }

    const repo = AppDataSource.getRepository(TeacherCodeforcesCredential);
    const existing = await repo.findOneBy({ teacher_id: teacherId });
    const config = existing ?? repo.create({ teacher_id: teacherId });
    const nextHandle = hasHandleInput
      ? input.codeforces_handle?.trim() || null
      : config.codeforces_handle;
    const nextApiKey = hasApiKeyInput
      ? input.codeforces_api_key?.trim() || null
      : config.codeforces_api_key;
    const nextApiSecret = hasApiSecretInput
      ? input.codeforces_api_secret?.trim() || null
      : config.codeforces_api_secret;
    const credentialsChanged = nextHandle !== config.codeforces_handle
      || nextApiKey !== config.codeforces_api_key
      || nextApiSecret !== config.codeforces_api_secret;

    if (hasHandleInput) {
      config.codeforces_handle = nextHandle;
    }

    if (hasApiKeyInput) {
      config.codeforces_api_key = nextApiKey;
    }

    if (hasApiSecretInput) {
      config.codeforces_api_secret = nextApiSecret;
    }

    if (!credentialsChanged && existing) {
      return existing;
    }

    config.updated_at = new Date();
    const saved = await repo.save(config);

    return saved;
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
