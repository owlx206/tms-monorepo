import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('discord_server_ownerships')
@Unique('uq_discord_server_ownerships_owner_server', ['discord_user_id', 'discord_server_id'])
@Index('idx_discord_server_ownerships_user_id', ['discord_user_id'])
@Index('idx_discord_server_ownerships_server_id', ['discord_server_id'])
export class DiscordServerOwnership {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 64 })
  discord_user_id!: string;

  @Column({ type: 'varchar', length: 50 })
  discord_server_id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  synced_at!: Date;
}
