import { Check, Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('discord_guild_channel_cache')
@Unique('uq_discord_guild_channel_cache_owner_channel', ['discord_user_id', 'discord_channel_id'])
@Index('idx_discord_guild_channel_cache_user_id', ['discord_user_id'])
@Index('idx_discord_guild_channel_cache_owner_guild', ['discord_user_id', 'discord_guild_id'])
@Check('chk_discord_guild_channel_cache_type', "[type] IN ('text', 'voice')")
export class DiscordGuildChannelCache {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 64 })
  discord_user_id!: string;

  @Column({ type: 'varchar', length: 50 })
  discord_guild_id!: string;

  @Column({ type: 'varchar', length: 50 })
  discord_channel_id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 16 })
  type!: 'text' | 'voice';

  @Column({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  synced_at!: Date;
}
