import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { DiscordClientFactory } from '../../../../infrastructure/external/discord/discord-api.service.js';
import type { DiscordRecipientResolver } from '../../../../infrastructure/external/discord/discord-recipient-resolver.js';
import type { DeliveryStatus, StudentMessageInput } from '../../contracts/types.js';
import type { TypeOrmMessagingWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

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

export class SendStudentMessagesUseCase {
  constructor(
    private readonly messagingWriter: TypeOrmMessagingWriter,
    private readonly discordClientFactory: DiscordClientFactory,
    private readonly discordRecipientResolver: DiscordRecipientResolver,
  ) {}

  async execute(teacherId: number, input: StudentMessageInput) {
    const { content } = input;

    if (input.class_id !== undefined) {
      const recipients = await this.messagingWriter.listStudentMessageRecipientContextsByClass(
        teacherId,
        input.class_id,
      );

      if (recipients.length === 0) {
        throw new HttpError('at least one recipient is required', 400);
      }

      return this.deliverStudentMessages(teacherId, content, recipients);
    }

    const studentIds = normalizeIdArray(input.student_ids);
    const recipients = await this.messagingWriter.listStudentMessageRecipientContextsByStudentIds(
      teacherId,
      studentIds,
    );
    if (recipients.length !== studentIds.length) {
      throw new HttpError('some students are invalid', 404);
    }

    return this.deliverStudentMessages(teacherId, content, recipients);
  }

  private async deliverStudentMessages(
    _teacherId: number,
    content: string,
    recipients: Awaited<ReturnType<TypeOrmMessagingWriter['listStudentMessageRecipientContextsByClass']>>,
  ) {
    const deliveryResults: Array<{
      student_id: number;
      student_name: string;
      status: DeliveryStatus;
      sent_at: Date | null;
      error_detail: string | null;
    }> = [];

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

      const resolvedRecipient = await this.discordRecipientResolver.resolve(
        guild,
        recipient.discord_username,
      );
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
        const discord = await this.discordClientFactory.getClient(guild.bot_token);
        await discord.sendDirectMessage({
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
