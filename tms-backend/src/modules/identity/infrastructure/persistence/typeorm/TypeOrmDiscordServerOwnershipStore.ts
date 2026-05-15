import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { DiscordServerChannel } from '../../../../../entities/discord-server-channel.entity.js';
import { DiscordServerOwnership } from '../../../../../entities/discord-server-ownership.entity.js';

export class TypeOrmDiscordServerOwnershipStore {
  findAnyByDiscordServerId(discordServerId: string): Promise<DiscordServerOwnership | null> {
    return AppDataSource.getRepository(DiscordServerOwnership).findOneBy({
      discord_server_id: discordServerId,
    });
  }

  findByOwnerAndDiscordServerId(
    discordUserId: string,
    discordServerId: string,
  ): Promise<DiscordServerOwnership | null> {
    return AppDataSource.getRepository(DiscordServerOwnership).findOneBy({
      discord_user_id: discordUserId,
      discord_server_id: discordServerId,
    });
  }

  createOwnership(values: Partial<DiscordServerOwnership>): DiscordServerOwnership {
    return AppDataSource.getRepository(DiscordServerOwnership).create(values);
  }

  saveOwnership(ownership: DiscordServerOwnership): Promise<DiscordServerOwnership> {
    return AppDataSource.getRepository(DiscordServerOwnership).save(ownership);
  }

  async replaceChannels(
    discordUserId: string,
    discordServerId: string,
    channels: Array<{ discord_channel_id: string; name: string; type: 'text' | 'voice' }>,
  ): Promise<DiscordServerChannel[]> {
    const repo = AppDataSource.getRepository(DiscordServerChannel);
    await repo.delete({
      discord_user_id: discordUserId,
      discord_server_id: discordServerId,
    });

    if (channels.length === 0) {
      return [];
    }

    return repo.save(channels.map((channel) => repo.create({
      discord_user_id: discordUserId,
      discord_server_id: discordServerId,
      discord_channel_id: channel.discord_channel_id,
      name: channel.name,
      type: channel.type,
      synced_at: new Date(),
    })));
  }
}
