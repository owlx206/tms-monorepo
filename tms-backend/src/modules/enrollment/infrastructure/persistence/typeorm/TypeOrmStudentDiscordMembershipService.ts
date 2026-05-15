import type { DataSource } from 'typeorm';

import type { DiscordServer } from '../../../../../entities/discord-server.entity.js';
import { DiscordClient } from '../../../../../infrastructure/external/discord/discord-api.service.js';
import type { SysadminDiscordBotCredentialStore } from '../../../../identity/index.js';
import type { SysadminDiscordBotCredential } from '../../../../../entities/sysadmin-discord-bot-credential.entity.js';
import { refreshStudentDiscordToken } from '../../../../identity/infrastructure/discord/DiscordStudentOAuth.js';
import {
  findActiveEnrollment,
  findDiscordServerByClass,
  findLastEnrollment,
  findRecentEnrollments,
} from './EnrollmentDataAccess.js';
import { Student } from '../../../../../entities/student.entity.js';

export type StudentDiscordInviteResult = {
  sent: boolean;
  reason: string | null;
};

export class TypeOrmStudentDiscordMembershipService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore,
  ) {}

  async onStudentEnrolled(
    teacherId: number,
    studentId: number,
    classId: number,
  ): Promise<StudentDiscordInviteResult> {
    return this.inviteStudentToClass(teacherId, studentId, classId);
  }

  async inviteStudentToCurrentClass(
    teacherId: number,
    studentId: number,
  ): Promise<StudentDiscordInviteResult> {
    const activeEnrollment = await findActiveEnrollment(this.dataSource.manager, teacherId, studentId);
    if (!activeEnrollment) {
      return { sent: false, reason: 'student has no active class enrollment' };
    }

    return this.inviteStudentToClass(teacherId, studentId, activeEnrollment.class_id);
  }

  private async inviteStudentToClass(
    teacherId: number,
    studentId: number,
    classId: number,
  ): Promise<StudentDiscordInviteResult> {
    const student = await this.dataSource.manager.getRepository(Student).findOneBy({
      teacher_id: teacherId,
      id: studentId,
    });
    if (!student?.discord_user_id?.trim()) {
      return { sent: false, reason: 'student must authorize Discord before being added to class server' };
    }

    const credential = await this.getSystemBotCredential();
    if (!credential) {
      return { sent: false, reason: 'system Discord bot token is not configured' };
    }

    const accessToken = await this.getValidStudentAccessToken(student, credential);
    if (!accessToken) {
      return { sent: false, reason: 'student must authorize Discord again' };
    }

    const server = await findDiscordServerByClass(this.dataSource.manager, teacherId, classId);
    if (!server) {
      return { sent: false, reason: 'class Discord server is not configured' };
    }

    return this.addStudentToClassServer({
      student,
      userAccessToken: accessToken,
      targetServer: server,
      token: credential.bot_token,
    });
  }

  async onStudentWithdrawn(teacherId: number, studentId: number): Promise<void> {
    const student = await this.dataSource.manager.getRepository(Student).findOneBy({
      teacher_id: teacherId,
      id: studentId,
    });
    if (!student?.discord_user_id?.trim()) {
      return;
    }

    const credential = await this.getSystemBotCredential();
    if (!credential) {
      return;
    }

    const lastEnrollment = await findLastEnrollment(this.dataSource.manager, teacherId, studentId);
    if (!lastEnrollment) {
      return;
    }

    const server = await findDiscordServerByClass(this.dataSource.manager, teacherId, lastEnrollment.class_id);
    if (!server) {
      return;
    }

    await this.kickFromServer({
      server: this.withSystemBotToken(server, credential.bot_token),
      userId: student.discord_user_id,
      token: credential.bot_token,
    });
  }

  async onStudentTransferred(
    teacherId: number,
    studentId: number,
    newClassId: number,
  ): Promise<StudentDiscordInviteResult> {
    const student = await this.dataSource.manager.getRepository(Student).findOneBy({
      teacher_id: teacherId,
      id: studentId,
    });
    if (!student?.discord_user_id?.trim()) {
      return { sent: false, reason: 'student must authorize Discord before being added to class server' };
    }

    const credential = await this.getSystemBotCredential();
    if (!credential) {
      return { sent: false, reason: 'system Discord bot token is not configured' };
    }

    const enrollments = await findRecentEnrollments(this.dataSource.manager, teacherId, studentId, 2);
    const oldEnrollment = enrollments.length >= 2 ? enrollments[1] : null;

    if (oldEnrollment) {
      const oldServer = await findDiscordServerByClass(this.dataSource.manager, teacherId, oldEnrollment.class_id);
      if (oldServer) {
        await this.kickFromServer({
          server: this.withSystemBotToken(oldServer, credential.bot_token),
          userId: student.discord_user_id,
          token: credential.bot_token,
        });
      }
    }

    const newServer = await findDiscordServerByClass(this.dataSource.manager, teacherId, newClassId);
    if (!newServer) {
      return { sent: false, reason: 'class Discord server is not configured' };
    }

    const accessToken = await this.getValidStudentAccessToken(student, credential);
    if (!accessToken) {
      return { sent: false, reason: 'student must authorize Discord again' };
    }

    return this.addStudentToClassServer({
      student,
      userAccessToken: accessToken,
      targetServer: newServer,
      token: credential.bot_token,
    });
  }

  private async getSystemBotCredential(): Promise<SysadminDiscordBotCredential | null> {
    const credential = await this.discordBotCredentialStore.findDefault();
    const token = credential?.bot_token?.trim();
    return credential && token && token.length > 0 ? credential : null;
  }

  private withSystemBotToken(server: DiscordServer, token: string): DiscordServer {
    return {
      ...server,
      bot_token: token,
    };
  }

  private async kickFromServer(input: {
    server: DiscordServer;
    userId: string;
    token: string;
  }): Promise<void> {
    try {
      await new DiscordClient(input.token).kickGuildMember({
        guildId: input.server.discord_server_id,
        userId: input.userId,
      });
    } catch {
    }
  }

  private async addStudentToClassServer(input: {
    student: Student;
    userAccessToken: string;
    targetServer: DiscordServer;
    token: string;
  }): Promise<StudentDiscordInviteResult> {
    try {
      const discord = new DiscordClient(input.token);
      const existingMember = await discord.fetchGuildMember({
        guildId: input.targetServer.discord_server_id,
        userId: input.student.discord_user_id ?? '',
      });
      if (existingMember) {
        return { sent: true, reason: null };
      }

      await discord.addGuildMember({
        guildId: input.targetServer.discord_server_id,
        userId: input.student.discord_user_id ?? '',
        userAccessToken: input.userAccessToken,
      });
      return { sent: true, reason: null };
    } catch (error) {
      return {
        sent: false,
        reason: error instanceof Error && error.message.trim()
          ? error.message
          : 'failed to add student to Discord class server',
      };
    }
  }

  private async getValidStudentAccessToken(
    student: Student,
    credential: SysadminDiscordBotCredential,
  ): Promise<string | null> {
    if (!student.discord_access_token || !student.discord_refresh_token || !student.discord_token_expires_at) {
      return null;
    }

    if (student.discord_token_expires_at.getTime() > Date.now() + 60_000) {
      return student.discord_access_token;
    }

    if (!credential.client_id || !credential.client_secret) {
      return null;
    }

    try {
      const refreshed = await refreshStudentDiscordToken({
        refreshToken: student.discord_refresh_token,
        clientId: credential.client_id,
        clientSecret: credential.client_secret,
      });
      await this.dataSource.manager.getRepository(Student).update(
        { teacher_id: student.teacher_id, id: student.id },
        {
          discord_access_token: refreshed.accessToken,
          discord_refresh_token: refreshed.refreshToken,
          discord_token_expires_at: refreshed.expiresAt,
        },
      );
      student.discord_access_token = refreshed.accessToken;
      student.discord_refresh_token = refreshed.refreshToken;
      student.discord_token_expires_at = refreshed.expiresAt;
      return refreshed.accessToken;
    } catch {
      return null;
    }
  }
}
