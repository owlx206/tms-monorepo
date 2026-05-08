import type { DataSource } from 'typeorm';

import type { DiscordServer } from '../../../../../entities/discord-server.entity.js';
import type { TeacherCommunityServer } from '../../../../../entities/teacher-community-server.entity.js';
import { DiscordClient } from '../../../../../integrations/discord/discord-api.service.js';
import { DiscordRecipientResolver } from '../../../../../integrations/discord/discord-recipient-resolver.js';
import type { SysadminDiscordBotCredentialStore } from '../../../../identity/index.js';
import type {
  StudentCommunityPort,
  StudentDiscordInviteResult,
} from '../../../application/ports/StudentCommunityPort.js';
import {
  findActiveEnrollment,
  findCommunityServerByTeacher,
  findDiscordServerByClass,
  findLastEnrollment,
  findRecentEnrollments,
} from './EnrollmentDataAccess.js';
import { Student } from './StudentOrmEntity.js';

export class TypeOrmStudentCommunityPort implements StudentCommunityPort {
  constructor(
    private readonly dataSource: DataSource,
    private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore,
  ) {}

  async onStudentEnrolled(teacherId: number, studentId: number, classId: number): Promise<void> {
    await this.inviteStudentToClass(teacherId, studentId, classId);
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
    const student = await this.dataSource.manager.getRepository(Student).findOneBy({ id: studentId });
    const studentDiscordIdentity = this.getStudentDiscordIdentity(student);
    if (!studentDiscordIdentity) {
      return { sent: false, reason: 'student has no Discord user ID or username' };
    }

    const token = await this.getSystemBotToken();
    if (!token) {
      return { sent: false, reason: 'system Discord bot token is not configured' };
    }

    const server = await findDiscordServerByClass(this.dataSource.manager, teacherId, classId);
    if (!server) {
      return { sent: false, reason: 'class Discord server is not configured' };
    }

    return this.sendClassInvite({
      teacherId,
      studentDiscordIdentity,
      targetServer: this.withSystemBotToken(server, token),
      token,
      fallbackServers: [],
    });
  }

  async onStudentWithdrawn(teacherId: number, studentId: number): Promise<void> {
    const student = await this.dataSource.manager.getRepository(Student).findOneBy({ id: studentId });
    const studentDiscordIdentity = this.getStudentDiscordIdentity(student);
    if (!studentDiscordIdentity) {
      return;
    }

    const token = await this.getSystemBotToken();
    if (!token) {
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
      server: this.withSystemBotToken(server, token),
      studentDiscordIdentity,
      token,
    });
  }

  async onStudentTransferred(
    teacherId: number,
    studentId: number,
    newClassId: number,
  ): Promise<void> {
    const student = await this.dataSource.manager.getRepository(Student).findOneBy({ id: studentId });
    const studentDiscordIdentity = this.getStudentDiscordIdentity(student);
    if (!studentDiscordIdentity) {
      return;
    }

    const token = await this.getSystemBotToken();
    if (!token) {
      return;
    }

    const enrollments = await findRecentEnrollments(this.dataSource.manager, teacherId, studentId, 2);
    const oldEnrollment = enrollments.length >= 2 ? enrollments[1] : null;
    const fallbackServers: DiscordServer[] = [];

    if (oldEnrollment) {
      const oldServer = await findDiscordServerByClass(this.dataSource.manager, teacherId, oldEnrollment.class_id);
      if (oldServer) {
        const oldServerWithToken = this.withSystemBotToken(oldServer, token);
        fallbackServers.push(oldServerWithToken);
        await this.kickFromServer({
          server: oldServerWithToken,
          studentDiscordIdentity,
          token,
        });
      }
    }

    const newServer = await findDiscordServerByClass(this.dataSource.manager, teacherId, newClassId);
    if (!newServer) {
      return;
    }

    await this.sendClassInvite({
      teacherId,
      studentDiscordIdentity,
      targetServer: this.withSystemBotToken(newServer, token),
      token,
      fallbackServers,
    });
  }

  private async getSystemBotToken(): Promise<string | null> {
    const credential = await this.discordBotCredentialStore.findDefault();
    const token = credential?.bot_token?.trim();
    return token && token.length > 0 ? token : null;
  }

  private getStudentDiscordIdentity(student: Student | null): string | null {
    return student?.discord_user_id?.trim() || student?.discord_username?.trim() || null;
  }

  private withSystemBotToken(server: DiscordServer, token: string): DiscordServer {
    return {
      ...server,
      bot_token: token,
    };
  }

  private communityServerAsResolverServer(
    server: TeacherCommunityServer,
    token: string,
  ): DiscordServer {
    return {
      id: server.id,
      teacher_id: server.teacher_id,
      class_id: 0,
      discord_server_id: server.discord_server_id,
      name: server.name,
      bot_token: token,
      attendance_voice_channel_id: server.voice_channel_id,
      notification_channel_id: server.notification_channel_id,
    };
  }

  private async kickFromServer(input: {
    server: DiscordServer;
    studentDiscordIdentity: string;
    token: string;
  }): Promise<void> {
    const resolvedRecipient = await new DiscordRecipientResolver().resolve(
      input.server,
      input.studentDiscordIdentity,
    );
    if (!resolvedRecipient.userId) {
      return;
    }

    try {
      await new DiscordClient(input.token).kickGuildMember({
        guildId: input.server.discord_server_id,
        userId: resolvedRecipient.userId,
      });
    } catch {
    }
  }

  private async sendClassInvite(input: {
    teacherId: number;
    studentDiscordIdentity: string;
    targetServer: DiscordServer;
    token: string;
    fallbackServers: DiscordServer[];
  }): Promise<StudentDiscordInviteResult> {
    const channelId = input.targetServer.notification_channel_id ?? input.targetServer.attendance_voice_channel_id;
    if (!channelId) {
      return { sent: false, reason: 'class Discord server has no invite channel configured' };
    }

    try {
      const discord = new DiscordClient(input.token);
      const invite = await discord.createGuildInvite({
        channelId,
        maxAge: 86400 * 7,
        maxUses: 1,
      });

      const recipientUserId = await this.resolveRecipientUserId({
        teacherId: input.teacherId,
        studentDiscordIdentity: input.studentDiscordIdentity,
        targetServer: input.targetServer,
        token: input.token,
        fallbackServers: input.fallbackServers,
      });
      if (!recipientUserId) {
        return { sent: false, reason: 'student could not be resolved on Discord' };
      }

      await discord.sendDirectMessage({
        recipientUserId,
        content: `Bạn đã được mời vào server Discord của lớp. Vui lòng tham gia tại đây: ${invite.url}`,
      });

      return { sent: true, reason: null };
    } catch (error) {
      return {
        sent: false,
        reason: error instanceof Error && error.message.trim()
          ? error.message
          : 'failed to send Discord class invite',
      };
    }
  }

  private async resolveRecipientUserId(input: {
    teacherId: number;
    studentDiscordIdentity: string;
    targetServer: DiscordServer;
    token: string;
    fallbackServers: DiscordServer[];
  }): Promise<string | null> {
    const resolver = new DiscordRecipientResolver();
    const communityServer = await findCommunityServerByTeacher(this.dataSource.manager, input.teacherId);
    const resolverServers = [
      ...(communityServer ? [this.communityServerAsResolverServer(communityServer, input.token)] : []),
      ...input.fallbackServers,
      input.targetServer,
    ];

    for (const server of resolverServers) {
      const resolvedRecipient = await resolver.resolve(server, input.studentDiscordIdentity);
      if (resolvedRecipient.userId) {
        return resolvedRecipient.userId;
      }
    }

    return null;
  }
}
