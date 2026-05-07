import type { DiscordMessageType } from '../../../../entities/enums.js';
import type { DiscordSetupIssue } from '../dto/MessagingDto.js';
import type { SysadminDiscordBotCredentialStore } from '../../../identity/infrastructure/persistence/typeorm/SysadminDiscordBotCredentialStore.js';
import type { MessagingReadRepository } from './MessagingReadRepository.js';

export class MessagingReadService {
  constructor(
    private readonly messagingReadRepository: MessagingReadRepository,
    private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore,
  ) {}

  async listDiscordServers(teacherId: number) {
    const servers = await this.messagingReadRepository.listDiscordServersForTeacher(teacherId);

    return servers.map((server) => ({
      ...server,
      bot_token: null,
    }));
  }

  async listMessages(teacherId: number, filters: { type?: DiscordMessageType }) {
    const messages = await this.messagingReadRepository.listMessagesForTeacher(teacherId, filters);

    if (messages.length === 0) {
      return [];
    }

    const messageIds = messages.map((message) => message.id);
    const recipientCounts = await this.messagingReadRepository.countRecipientsByMessageIds(
      teacherId,
      messageIds,
    );

    const countMap = new Map(
      recipientCounts.map((row) => [
        Number(row.message_id),
        {
          total: Number(row.total),
          sent: Number(row.sent),
          failed: Number(row.failed),
        },
      ]),
    );

    const failedRecipients = await this.messagingReadRepository.listFailedRecipientsByMessageIds(
      teacherId,
      messageIds,
    );
    const failuresByMessageId = new Map<number, Array<{
      student_id: number;
      student_name: string;
      error: string;
    }>>();

    failedRecipients.forEach((recipient) => {
      const messageId = Number(recipient.message_id);
      const failures = failuresByMessageId.get(messageId) ?? [];
      failures.push({
        student_id: Number(recipient.student_id),
        student_name: recipient.student_name ?? `Học sinh #${recipient.student_id}`,
        error: recipient.error_detail ?? 'unknown delivery error',
      });
      failuresByMessageId.set(messageId, failures);
    });

    return messages.map((message) => ({
      ...message,
      recipients: countMap.get(message.id) ?? { total: 0, sent: 0, failed: 0 },
      failures: failuresByMessageId.get(message.id) ?? [],
    }));
  }

  async getCommunityServer(teacherId: number) {
    return this.messagingReadRepository.findCommunityServerForTeacher(teacherId);
  }

  async getBotInviteLink(_teacherId: number) {
    const credential = await this.discordBotCredentialStore.findDefault();
    const clientId = credential?.client_id.trim() ?? '';
    if (!clientId) {
      return null;
    }

    const search = new URLSearchParams({
      client_id: clientId,
      scope: credential?.scopes?.trim() || 'bot applications.commands',
    });

    if (credential?.permissions?.trim()) {
      search.set('permissions', credential.permissions.trim());
    }

    return `https://discord.com/oauth2/authorize?${search.toString()}`;
  }

  listTeacherDiscordServers(teacherId: number) {
    return this.messagingReadRepository.listTeacherDiscordServers(teacherId).then((servers) => servers.map((server) => ({
      id: server.id,
      teacher_id: server.teacher_id,
      discord_server_id: server.discord_server_id,
      name: server.name,
      synced_at: server.synced_at,
      binding: {
        role: server.binding_role,
        server_binding_id: server.binding_server_id,
        class_id: server.binding_class_id,
        class_name: server.binding_class_name,
        notification_channel_id: server.binding_notification_channel_id,
        notification_channel_name: server.binding_notification_channel_name,
        notification_channel_cache_id: server.binding_notification_channel_cache_id,
        attendance_voice_channel_id: server.binding_attendance_voice_channel_id,
        attendance_voice_channel_name: server.binding_attendance_voice_channel_name,
        attendance_voice_channel_cache_id: server.binding_attendance_voice_channel_cache_id,
      },
    })));
  }

  listTeacherDiscordChannelsForServer(teacherId: number, discordServerId: string) {
    return this.messagingReadRepository.listTeacherDiscordChannelsForServer(teacherId, discordServerId);
  }

  async getSetupStatus(teacherId: number) {
    const [
      communityServer,
      activeStudents,
      studentsWithDiscordUsername,
      activeClasses,
      configuredClassServers,
      missingClassServerNames,
      syncedServers,
    ] = await Promise.all([
      this.messagingReadRepository.findCommunityServerForTeacher(teacherId),
      this.messagingReadRepository.countActiveStudentsForTeacher(teacherId),
      this.messagingReadRepository.countActiveStudentsWithDiscordUsernameForTeacher(teacherId),
      this.messagingReadRepository.countActiveClassesForTeacher(teacherId),
      this.messagingReadRepository.countConfiguredDiscordServersForTeacher(teacherId),
      this.messagingReadRepository.listActiveClassesMissingDiscordServerNamesForTeacher(teacherId),
      this.messagingReadRepository.countTeacherDiscordServerCaches(teacherId),
    ]);

    const [inviteLink, credential] = await Promise.all([
      this.getBotInviteLink(teacherId),
      this.discordBotCredentialStore.findDefault(),
    ]);
    const issues: DiscordSetupIssue[] = [];

    if (!credential?.bot_token || !inviteLink) {
      issues.push({
        code: 'sysadmin_bot_missing',
        severity: 'critical',
        title: 'Bot Discord chưa được cấu hình',
        description: 'Sysadmin cần cấu hình bot credential và bot invite link trước khi giáo viên có thể dùng Discord.',
        cta_action: null,
        cta_label: null,
      });
    }

    if (credential?.bot_token && syncedServers === 0) {
      issues.push({
        code: 'discord_servers_not_synced',
        severity: 'critical',
        title: 'Chưa đồng bộ được server Discord nào',
        description: 'Mở invite link, thêm bot vào server của bạn, rồi bấm đồng bộ lại để hệ thống lấy danh sách server và channel.',
        cta_action: inviteLink ? 'open_bot_invite' : 'sync_servers',
        cta_label: inviteLink ? 'Mời bot vào server' : 'Đồng bộ server',
      });
    }

    if (!communityServer) {
      issues.push({
        code: 'community_server_missing',
        severity: 'critical',
        title: 'Chưa có server chung',
        description: 'Hãy thêm bot vào server Discord chung của bạn rồi cấu hình server chung trong app.',
        cta_action: 'open_community_server',
        cta_label: 'Cấu hình server chung',
      });
    } else {
      if (!communityServer.voice_channel_id) {
        issues.push({
          code: 'community_voice_channel_missing',
          severity: 'warning',
          title: 'Server chung chưa có voice channel',
          description: 'Chọn voice channel dùng cho vận hành community server.',
          cta_action: 'open_community_server',
          cta_label: 'Cập nhật server chung',
        });
      }

      if (!communityServer.notification_channel_id) {
        issues.push({
          code: 'community_notification_channel_missing',
          severity: 'warning',
          title: 'Server chung chưa có kênh thông báo',
          description: 'Chọn kênh dùng để bot gửi thông báo chung hoặc broadcast khi cần.',
          cta_action: 'open_community_server',
          cta_label: 'Cập nhật server chung',
        });
      }
    }

    const studentsMissingDiscordUsername = Math.max(0, activeStudents - studentsWithDiscordUsername);
    if (studentsMissingDiscordUsername > 0) {
      issues.push({
        code: 'students_missing_discord_username',
        severity: 'warning',
        title: `Còn ${studentsMissingDiscordUsername} học sinh thiếu Discord username`,
        description: 'Các học sinh này chưa sẵn sàng để nhận DM hoặc được đối soát invite qua Discord.',
        cta_action: 'review_students',
        cta_label: 'Rà lại học sinh',
      });
    }

    if (missingClassServerNames.length > 0) {
      const preview = missingClassServerNames.slice(0, 3).join(', ');
      issues.push({
        code: 'class_servers_missing',
        severity: 'warning',
        title: `Còn ${missingClassServerNames.length} lớp chưa có server riêng`,
        description: missingClassServerNames.length <= 3
          ? `Chưa cấu hình server cho: ${preview}.`
          : `Chưa cấu hình server cho: ${preview} và ${missingClassServerNames.length - 3} lớp khác.`,
        cta_action: 'open_class_server',
        cta_label: 'Cấu hình server lớp',
      });
    }

    if (issues.length === 0) {
      issues.push({
        code: 'setup_healthy',
        severity: 'info',
        title: 'Cấu hình Discord đang ổn',
        description: 'Server chung và server lớp chính đã có đủ cấu hình để tiếp tục vận hành.',
        cta_action: null,
        cta_label: null,
      });
    }

    return {
      invite_link: inviteLink,
      bot_configured: Boolean(credential?.bot_token && credential?.client_id),
      community_server: communityServer,
      metrics: {
        active_students: activeStudents,
        students_with_discord_username: studentsWithDiscordUsername,
        students_missing_discord_username: studentsMissingDiscordUsername,
        active_classes: activeClasses,
        configured_class_servers: configuredClassServers,
        classes_missing_server: Math.max(0, activeClasses - configuredClassServers),
        synced_servers: syncedServers,
      },
      missing_class_server_names: missingClassServerNames,
      issues,
    };
  }
}
