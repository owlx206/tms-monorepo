import { StudentStatus } from '../../../../entities/enums.js';
import { DiscordClient } from '../../../../infrastructure/external/discord/discord-api.service.js';
import { ServiceError } from '../../../../shared/errors/service.error.js';
import type { DiscordServer } from '../../../../entities/discord-server.entity.js';
import type { SysadminDiscordBotCredentialStore } from '../../../identity/index.js';
import type { DiscordServerContext } from '../../infrastructure/discord/discord.types.js';
import type {
  DiscordMembershipSyncFailure,
  DiscordMembershipSyncResult,
} from '../dto/MessagingDto.js';
import type {
  DiscordMembershipSyncStudent,
  TypeOrmMessagingWriter,
} from '../../infrastructure/persistence/typeorm/TypeOrmMessagingWriter.js';
import { refreshStudentDiscordToken } from '../../infrastructure/discord/DiscordStudentOAuth.js';
import { SyncTeacherDiscordServersUseCase } from './SyncTeacherDiscordServersUseCase.js';

function toFailure(input: {
  student: DiscordMembershipSyncStudent;
  code: string;
  message: string;
}): DiscordMembershipSyncFailure {
  return {
    student_id: input.student.student_id,
    student_name: input.student.student_name,
    class_id: input.student.active_class_id ?? input.student.last_class_id,
    class_name: input.student.active_class_name ?? input.student.last_class_name,
    code: input.code,
    message: input.message,
  };
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ServiceError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function withToken(server: DiscordServerContext, token: string): DiscordServer {
  return {
    ...server,
    class_id: server.class_id ?? 0,
    bot_token: token,
  };
}

export class SyncDiscordMembershipUseCase {
  constructor(
    private readonly repository: TypeOrmMessagingWriter,
    private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore,
    private readonly syncDiscordServers: SyncTeacherDiscordServersUseCase,
  ) {}

  async execute(teacherId: number): Promise<DiscordMembershipSyncResult> {
    const credential = await this.discordBotCredentialStore.findDefault();
    const token = credential?.bot_token?.trim();
    if (!credential || !token) {
      throw new ServiceError('discord bot is not configured by sysadmin', 503);
    }

    const serverSync = await this.syncDiscordServers.execute(teacherId);
    const students = await this.repository.listDiscordMembershipSyncStudents(teacherId);
    const result: DiscordMembershipSyncResult = {
      synced_servers: serverSync.synced_servers,
      total_students: students.length,
      resolved_students: 0,
      discord_user_ids_updated: 0,
      already_in_class_server: 0,
      joined_class_server: 0,
      kicked_from_class_server: 0,
      failed: 0,
      failures: [],
    };

    const discord = new DiscordClient(token);

    for (const student of students) {
      if (student.status === StudentStatus.Active) {
        await this.syncActiveStudent({
          teacherId,
          student,
          discord,
          clientId: credential.client_id,
          clientSecret: credential.client_secret,
          result,
        });
      } else {
        await this.syncInactiveStudent({ student, discord, result });
      }
    }

    result.failed = result.failures.length;
    return result;
  }

  private async syncActiveStudent(input: {
    teacherId: number;
    student: DiscordMembershipSyncStudent;
    discord: DiscordClient;
    clientId?: string | null;
    clientSecret?: string | null;
    result: DiscordMembershipSyncResult;
  }): Promise<void> {
    const { student, discord, result } = input;
    if (!student.discord_user_id?.trim()) {
      result.failures.push(toFailure({
        student,
        code: 'student_discord_authorization_missing',
        message: 'student must authorize Discord before being added to class server',
      }));
      return;
    }

    if (!student.active_class_id) {
      result.failures.push(toFailure({
        student,
        code: 'student_active_enrollment_missing',
        message: 'student has no active enrollment',
      }));
      return;
    }

    if (!student.class_server) {
      result.failures.push(toFailure({
        student,
        code: 'class_discord_server_missing',
        message: 'active class has no Discord server configured',
      }));
      return;
    }

    if (!student.discord_access_token || !student.discord_refresh_token || !student.discord_token_expires_at) {
      result.failures.push(toFailure({
        student,
        code: 'student_discord_authorization_missing',
        message: 'student must authorize Discord before being added to class server',
      }));
      return;
    }

    result.resolved_students += 1;
    const classServer = withToken(student.class_server, '');

    try {
      const member = await discord.fetchGuildMember({
        guildId: classServer.discord_server_id,
        userId: student.discord_user_id,
      });
      if (member) {
        result.already_in_class_server += 1;
        return;
      }
    } catch (error) {
      result.failures.push(toFailure({
        student,
        code: 'class_membership_check_failed',
        message: toErrorMessage(error, 'failed to check class Discord membership'),
      }));
      return;
    }

    const accessToken = await this.getValidStudentAccessToken({
      teacherId: input.teacherId,
      student,
      clientId: input.clientId,
      clientSecret: input.clientSecret,
    });
    if (!accessToken) {
      result.failures.push(toFailure({
        student,
        code: 'student_discord_token_refresh_failed',
        message: 'student must authorize Discord again',
      }));
      return;
    }

    try {
      await discord.addGuildMember({
        guildId: classServer.discord_server_id,
        userId: student.discord_user_id,
        userAccessToken: accessToken,
      });
      result.joined_class_server += 1;
    } catch (error) {
      result.failures.push(toFailure({
        student,
        code: 'class_join_failed',
        message: toErrorMessage(error, 'failed to add student to class Discord server'),
      }));
    }
  }

  private async getValidStudentAccessToken(input: {
    teacherId: number;
    student: DiscordMembershipSyncStudent;
    clientId?: string | null;
    clientSecret?: string | null;
  }): Promise<string | null> {
    const expiresAt = input.student.discord_token_expires_at;
    if (expiresAt && expiresAt.getTime() > Date.now() + 60_000) {
      return input.student.discord_access_token;
    }

    if (!input.clientId || !input.clientSecret || !input.student.discord_refresh_token) {
      return null;
    }

    try {
      const refreshed = await refreshStudentDiscordToken({
        refreshToken: input.student.discord_refresh_token,
        clientId: input.clientId,
        clientSecret: input.clientSecret,
      });
      await this.repository.updateStudentDiscordTokens({
        teacherId: input.teacherId,
        studentId: input.student.student_id,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        tokenExpiresAt: refreshed.expiresAt,
      });
      return refreshed.accessToken;
    } catch {
      return null;
    }
  }

  private async syncInactiveStudent(input: {
    student: DiscordMembershipSyncStudent;
    discord: DiscordClient;
    result: DiscordMembershipSyncResult;
  }): Promise<void> {
    const { student, discord, result } = input;
    if (!student.last_class_server) {
      return;
    }

    if (!student.discord_user_id?.trim()) {
      return;
    }

    const lastClassServer = withToken(student.last_class_server, '');
    try {
      await discord.kickGuildMember({
        guildId: lastClassServer.discord_server_id,
        userId: student.discord_user_id,
      });
      result.kicked_from_class_server += 1;
    } catch (error) {
      result.failures.push(toFailure({
        student,
        code: 'class_kick_failed',
        message: toErrorMessage(error, 'failed to kick inactive student from class Discord server'),
      }));
    }
  }
}
