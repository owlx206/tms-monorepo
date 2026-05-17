import type { SysadminDiscordBotCredentialStore } from '../../identity/index.js';
import type { DiscordSetupIssue } from '../application/dto/MessagingDto.js';
import { GetBotInviteLinkUseCase } from '../application/queries/GetBotInviteLinkUseCase.js';

type MessagingReader = {
  countActiveStudentsForTeacher(teacherId: number): Promise<number>;
  countActiveStudentsWithDiscordUsernameForTeacher(teacherId: number): Promise<number>;
  countActiveStudentsWithDiscordAuthorizationForTeacher(teacherId: number): Promise<number>;
  countActiveClassesForTeacher(teacherId: number): Promise<number>;
  countConfiguredDiscordGuildsForTeacher(teacherId: number): Promise<number>;
  listActiveClassesMissingDiscordGuildNamesForTeacher(teacherId: number): Promise<string[]>;
  countDiscordUserGuildsForTeacher(teacherId: number): Promise<number>;
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
      configuredClassGuilds,
      missingClassGuildNames,
      syncedGuilds,
    ] = await Promise.all([
      this.messaging.countActiveStudentsForTeacher(teacherId),
      this.messaging.countActiveStudentsWithDiscordUsernameForTeacher(teacherId),
      this.messaging.countActiveStudentsWithDiscordAuthorizationForTeacher(teacherId),
      this.messaging.countActiveClassesForTeacher(teacherId),
      this.messaging.countConfiguredDiscordGuildsForTeacher(teacherId),
      this.messaging.listActiveClassesMissingDiscordGuildNamesForTeacher(teacherId),
      this.messaging.countDiscordUserGuildsForTeacher(teacherId),
    ]);

    const [inviteLink, credential] = await Promise.all([
      this.getBotInviteLink.execute(teacherId),
      this.discordBotCredentialStore.findDefault(),
    ]);
    const issues: DiscordSetupIssue[] = [];

    if (!credential?.bot_token || !inviteLink) {
      issues.push({
        code: 'discord_unavailable',
        severity: 'critical',
        title: 'Discord chưa sẵn sàng',
        description: 'Tính năng Discord hiện chưa thể sử dụng. Vui lòng thử lại sau.',
        cta_action: null,
        cta_label: null,
      });
    }

    if (credential?.bot_token && syncedGuilds === 0) {
      issues.push({
        code: 'class_discord_bindings_not_synced',
        severity: 'critical',
        title: 'Chưa đồng bộ được Discord guild nào',
        description: 'Mở invite link và thêm bot vào guild của bạn. Sau khi Discord chuyển về hệ thống, danh sách guild và channel sẽ được cập nhật tự động.',
        cta_action: inviteLink ? 'open_bot_invite' : null,
        cta_label: inviteLink ? 'Mời bot vào guild' : null,
      });
    }

    const studentsMissingDiscordUsername = Math.max(0, activeStudents - studentsWithDiscordUsername);
    const studentsMissingDiscordAuthorization = Math.max(0, activeStudents - studentsWithDiscordAuthorization);
    if (studentsMissingDiscordUsername > 0) {
      issues.push({
        code: 'students_missing_discord_username',
        severity: 'warning',
        title: `Còn ${studentsMissingDiscordUsername} học sinh thiếu Discord username`,
        description: 'Discord username chỉ là thông tin hiển thị. Với luồng mới, học sinh cần authorize Discord bằng link để hệ thống add/kick guild lớp.',
        cta_action: 'review_students',
        cta_label: 'Rà lại học sinh',
      });
    }

    if (studentsMissingDiscordAuthorization > 0) {
      issues.push({
        code: 'students_missing_discord_authorization',
        severity: 'warning',
        title: `Còn ${studentsMissingDiscordAuthorization} học sinh chưa authorize Discord`,
        description: 'Học sinh chưa authorize sẽ không được hệ thống tự add/kick khỏi guild lớp.',
        cta_action: 'review_students',
        cta_label: 'Rà lại học sinh',
      });
    }

    if (
      credential?.bot_token
      && configuredClassGuilds > 0
      && activeStudents > 0
      && studentsMissingDiscordAuthorization === 0
    ) {
      issues.push({
        code: 'discord_membership_sync_available',
        severity: 'info',
        title: 'Có thể đồng bộ học sinh với Discord',
        description: 'Chạy đồng bộ để add học sinh đã authorize vào guild lớp hiện tại và gỡ học sinh đã nghỉ khỏi guild lớp cũ.',
        cta_action: null,
        cta_label: null,
      });
    }

    if (missingClassGuildNames.length > 0) {
      const preview = missingClassGuildNames.slice(0, 3).join(', ');
      issues.push({
        code: 'class_guilds_missing',
        severity: 'warning',
        title: `Còn ${missingClassGuildNames.length} lớp chưa có guild riêng`,
        description: missingClassGuildNames.length <= 3
          ? `Chưa cấu hình guild cho: ${preview}.`
          : `Chưa cấu hình guild cho: ${preview} và ${missingClassGuildNames.length - 3} lớp khác.`,
        cta_action: 'open_class_guild',
        cta_label: 'Cấu hình guild lớp',
      });
    }

    if (issues.length === 0) {
      issues.push({
        code: 'setup_healthy',
        severity: 'info',
        title: 'Cấu hình Discord đang ổn',
        description: 'Guild lớp chính đã có đủ cấu hình để tiếp tục vận hành.',
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
        configured_class_guilds: configuredClassGuilds,
        classes_missing_guild: Math.max(0, activeClasses - configuredClassGuilds),
        synced_guilds: syncedGuilds,
      },
      missing_class_guild_names: missingClassGuildNames,
      issues,
    };
  }
}
