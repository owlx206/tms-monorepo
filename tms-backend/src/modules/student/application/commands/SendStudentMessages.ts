import {
  resolveDiscordBotToken,
  sendDiscordDirectMessage,
  type DiscordBotCredentialSource,
  type DiscordRecipientResolver,
} from '../../../../infrastructure/external/discord/discord.js';
import { listClassDiscordBindingsByClassIds } from '../../../classroom/infrastructure/persistence/typeorm/Reader.js';
import { listStudentDiscordIdentities } from '../../../identity/infrastructure/persistence/typeorm/Writer.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { DeliveryStatus, StudentMessageInput } from '../../contracts/types.js';
import {
  listStudentMessageRecipientBasesByClass,
  listStudentMessageRecipientBasesByStudentIds,
  type StudentMessageRecipientBase,
} from '../../infrastructure/persistence/typeorm/Reader.js';

type StudentMessageRecipientContext = StudentMessageRecipientBase & {
  discord_username: string | null;
  discord_user_id: string | null;
  discord_guild: {
    discord_guild_id: string;
  } | null;
};

function normalizeIdArray(values: number[] | undefined): number[] {
  if (!values) {
    return [];
  }

  return Array.from(new Set(values.filter((item) => Number.isInteger(item) && item > 0)));
}

function toFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export class SendStudentMessages {
  constructor(
    private readonly discordBotCredentialSource: DiscordBotCredentialSource,
    private readonly discordRecipientResolver: DiscordRecipientResolver,
  ) {}

  async execute(teacherId: number, input: StudentMessageInput) {
    const { content } = input;

    if (input.class_id !== undefined) {
      const recipients = await this.loadRecipientContexts(
        teacherId,
        await listStudentMessageRecipientBasesByClass(teacherId, input.class_id),
      );

      if (recipients.length === 0) {
        throw new HttpError('at least one recipient is required', 400);
      }

      return this.deliverStudentMessages(content, recipients);
    }

    const studentIds = normalizeIdArray(input.student_ids);
    const recipients = await this.loadRecipientContexts(
      teacherId,
      await listStudentMessageRecipientBasesByStudentIds(teacherId, studentIds),
    );
    if (recipients.length !== studentIds.length) {
      throw new HttpError('some students are invalid', 404);
    }

    return this.deliverStudentMessages(content, recipients);
  }

  private async loadRecipientContexts(
    teacherId: number,
    recipientBases: StudentMessageRecipientBase[],
  ): Promise<StudentMessageRecipientContext[]> {
    const studentIds = recipientBases.map((recipient) => recipient.student_id);
    const classIds = recipientBases
      .map((recipient) => recipient.active_class_id)
      .filter((classId): classId is number => classId !== null);
    const [discordIdentities, classGuilds] = await Promise.all([
      listStudentDiscordIdentities(studentIds),
      listClassDiscordBindingsByClassIds(teacherId, classIds),
    ]);
    const identityByStudentId = new Map(discordIdentities.map((identity) => [identity.student_id, identity]));
    const guildByClassId = new Map(classGuilds.map((guild) => [guild.class_id, guild]));

    return recipientBases.map((recipient) => {
      const identity = identityByStudentId.get(recipient.student_id);
      const guild = recipient.active_class_id === null ? null : guildByClassId.get(recipient.active_class_id) ?? null;

      return {
        ...recipient,
        discord_username: identity?.discord_username ?? null,
        discord_user_id: identity?.discord_user_id ?? null,
        discord_guild: guild ? { discord_guild_id: guild.discord_guild_id } : null,
      };
    });
  }

  private async deliverStudentMessages(
    content: string,
    recipients: StudentMessageRecipientContext[],
  ) {
    const deliveryResults: Array<{
      student_id: number;
      student_name: string;
      status: DeliveryStatus;
      sent_at: Date | null;
      error_detail: string | null;
    }> = [];

    const botToken = await resolveDiscordBotToken(this.discordBotCredentialSource);

    for (const recipient of recipients) {
      if (!recipient.active_class_id) {
        deliveryResults.push({
          student_id: recipient.student_id,
          student_name: recipient.student_name,
          status: 'failed',
          sent_at: null,
          error_detail: 'student is not in an active class',
        });
        continue;
      }

      const guild = recipient.discord_guild;
      if (!guild) {
        deliveryResults.push({
          student_id: recipient.student_id,
          student_name: recipient.student_name,
          status: 'failed',
          sent_at: null,
          error_detail: 'discord guild is not configured for this class',
        });
        continue;
      }

      const resolvedRecipient = await this.discordRecipientResolver.resolve({
        botToken,
        guild,
        discordUsername: recipient.discord_user_id ?? recipient.discord_username,
      });
      if (!resolvedRecipient.userId) {
        deliveryResults.push({
          student_id: recipient.student_id,
          student_name: recipient.student_name,
          status: 'failed',
          sent_at: null,
          error_detail: resolvedRecipient.error ?? 'failed to resolve discord_username',
        });
        continue;
      }

      try {
        await sendDiscordDirectMessage({
          botToken,
          recipientUserId: resolvedRecipient.userId,
          content,
        });
        deliveryResults.push({
          student_id: recipient.student_id,
          student_name: recipient.student_name,
          status: 'sent',
          sent_at: new Date(),
          error_detail: null,
        });
      } catch (error) {
        deliveryResults.push({
          student_id: recipient.student_id,
          student_name: recipient.student_name,
          status: 'failed',
          sent_at: null,
          error_detail: toFailureMessage(error, 'failed to send DM'),
        });
      }
    }

    const sentCount = deliveryResults.filter((result) => result.status === 'sent').length;

    return {
      recipients_total: deliveryResults.length,
      sent: sentCount,
      failed: deliveryResults.length - sentCount,
      failures: deliveryResults
        .filter((result) => result.status === 'failed')
        .map((result) => ({
          student_id: result.student_id,
          student_name: result.student_name,
          error: result.error_detail ?? 'unknown delivery error',
        })),
    };
  }
}
