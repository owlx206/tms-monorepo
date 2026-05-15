import type { SysadminDiscordBotCredentialStore } from '../../identity/index.js';
import type { DiscordSetupIssue } from '../application/dto/MessagingDto.js';
import { GetBotInviteLinkUseCase } from '../application/queries/GetBotInviteLinkUseCase.js';

type MessagingReader = {
  countActiveStudentsForTeacher(teacherId: number): Promise<number>;
  countActiveStudentsWithDiscordUsernameForTeacher(teacherId: number): Promise<number>;
  countActiveStudentsWithDiscordAuthorizationForTeacher(teacherId: number): Promise<number>;
  countActiveClassesForTeacher(teacherId: number): Promise<number>;
  countConfiguredDiscordServersForTeacher(teacherId: number): Promise<number>;
  listActiveClassesMissingDiscordServerNamesForTeacher(teacherId: number): Promise<string[]>;
  countDiscordServerOwnershipsForTeacher(teacherId: number): Promise<number>;
};

export class DiscordSetupStatus {
  constructor(
    private readonly messaging: MessagingReader,
    private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore,
    private readonly getBotInviteLink: GetBotInviteLinkUseCase,
  ) {}

  async execute(teacherId: number) {
    const [
      activeStudents,
      studentsWithDiscordUsername,
      studentsWithDiscordAuthorization,
      activeClasses,
      configuredClassServers,
      missingClassServerNames,
      syncedServers,
    ] = await Promise.all([
      this.messaging.countActiveStudentsForTeacher(teacherId),
      this.messaging.countActiveStudentsWithDiscordUsernameForTeacher(teacherId),
      this.messaging.countActiveStudentsWithDiscordAuthorizationForTeacher(teacherId),
      this.messaging.countActiveClassesForTeacher(teacherId),
      this.messaging.countConfiguredDiscordServersForTeacher(teacherId),
      this.messaging.listActiveClassesMissingDiscordServerNamesForTeacher(teacherId),
      this.messaging.countDiscordServerOwnershipsForTeacher(teacherId),
    ]);

    const [inviteLink, credential] = await Promise.all([
      this.getBotInviteLink.execute(teacherId),
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
        cta_action: inviteLink ? 'open_bot_invite' : null,
        cta_label: inviteLink ? 'Mời bot vào server' : null,
      });
    }

    const studentsMissingDiscordUsername = Math.max(0, activeStudents - studentsWithDiscordUsername);
    const studentsMissingDiscordAuthorization = Math.max(0, activeStudents - studentsWithDiscordAuthorization);
    if (studentsMissingDiscordUsername > 0) {
      issues.push({
        code: 'students_missing_discord_username',
        severity: 'warning',
        title: `Còn ${studentsMissingDiscordUsername} học sinh thiếu Discord username`,
        description: 'Discord username chỉ là thông tin hiển thị. Với luồng mới, học sinh cần authorize Discord bằng link để hệ thống add/kick server lớp.',
        cta_action: 'review_students',
        cta_label: 'Rà lại học sinh',
      });
    }

    if (studentsMissingDiscordAuthorization > 0) {
      issues.push({
        code: 'students_missing_discord_authorization',
        severity: 'warning',
        title: `Còn ${studentsMissingDiscordAuthorization} học sinh chưa authorize Discord`,
        description: 'Học sinh chưa authorize sẽ không được hệ thống tự add/kick khỏi server lớp.',
        cta_action: 'review_students',
        cta_label: 'Rà lại học sinh',
      });
    }

    if (
      credential?.bot_token
      && configuredClassServers > 0
      && activeStudents > 0
      && studentsMissingDiscordAuthorization === 0
    ) {
      issues.push({
        code: 'discord_membership_sync_available',
        severity: 'info',
        title: 'Có thể đồng bộ học sinh với Discord',
        description: 'Chạy đồng bộ để add học sinh đã authorize vào server lớp hiện tại và gỡ học sinh đã nghỉ khỏi server lớp cũ.',
        cta_action: null,
        cta_label: null,
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
        description: 'Server lớp chính đã có đủ cấu hình để tiếp tục vận hành.',
        cta_action: null,
        cta_label: null,
      });
    }

    return {
      invite_link: inviteLink,
      bot_configured: Boolean(credential?.bot_token && credential?.client_id),
      metrics: {
        active_students: activeStudents,
        students_with_discord_username: studentsWithDiscordUsername,
        students_missing_discord_username: studentsMissingDiscordUsername,
        students_with_discord_authorization: studentsWithDiscordAuthorization,
        students_missing_discord_authorization: studentsMissingDiscordAuthorization,
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
