import { ServiceError } from '../../../../shared/errors/service.error.js';
import type { ChannelPostInput } from '../dto/MessagingDto.js';
import type { StoredDiscordGateway } from '../../infrastructure/discord/StoredDiscordGateway.js';
import type { TypeOrmMessagingWriter } from '../../infrastructure/persistence/typeorm/TypeOrmMessagingWriter.js';

function normalizeIdArray(values: number[] | undefined): number[] {
  if (!values) {
    return [];
  }

  return Array.from(new Set(values.filter((item) => Number.isInteger(item) && item > 0)));
}

function toFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof ServiceError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export class SendChannelPostUseCase {
  constructor(
    private readonly messagingWriter: TypeOrmMessagingWriter,
    private readonly discordGateway: StoredDiscordGateway,
  ) {}

  async execute(teacherId: number, input: ChannelPostInput) {
    const { content } = input;
    const serverIds = normalizeIdArray(input.server_ids);
    const servers = await this.messagingWriter.findDiscordServersByIds(teacherId, serverIds);

    if (servers.length !== serverIds.length) {
      throw new ServiceError('some servers are invalid', 404);
    }

    const serverById = new Map(servers.map((server) => [server.id, server]));
    const orderedServers = serverIds
      .map((serverId) => serverById.get(serverId))
      .filter((item): item is NonNullable<typeof item> => item !== undefined);

    const successfulServers: typeof orderedServers = [];
    const failures: Array<{ server_id: number; error: string }> = [];

    for (const server of orderedServers) {
      if (!server.notification_channel_id) {
        failures.push({ server_id: server.id, error: 'notification_channel_id is missing' });
        continue;
      }

      try {
        await this.discordGateway.ensureChannelBelongsToGuild(
          {
            channelId: server.notification_channel_id,
            guildId: server.discord_server_id,
            fieldName: 'notification_channel_id',
          },
          server.bot_token,
        );
        await this.discordGateway.postChannelMessage(
          {
            channelId: server.notification_channel_id,
            content,
          },
          server.bot_token,
        );
        successfulServers.push(server);
      } catch (error) {
        failures.push({
          server_id: server.id,
          error: toFailureMessage(error, 'failed to send message'),
        });
      }
    }

    return {
      targets_total: orderedServers.length,
      sent: successfulServers.length,
      failed: failures.length,
      failures,
    };
  }
}
