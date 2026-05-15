import { Check, Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('discord_server_channels')
@Unique('uq_discord_server_channels_owner_channel', ['discord_user_id', 'discord_channel_id'])
@Index('idx_discord_server_channels_user_id', ['discord_user_id'])
@Index('idx_discord_server_channels_owner_server', ['discord_user_id', 'discord_server_id'])
@Check('chk_discord_server_channels_type', `"type" IN ('text', 'voice')`)
export class DiscordServerChannel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 64 })
  discord_user_id!: string;

  @Column({ type: 'varchar', length: 50 })
  discord_server_id!: string;

  @Column({ type: 'varchar', length: 50 })
  discord_channel_id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 16 })
  type!: 'text' | 'voice';

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  synced_at!: Date;
}
