import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('discord_user_guilds')
@Unique('uq_discord_user_guilds_owner_guild', ['discord_user_id', 'discord_guild_id'])
@Index('idx_discord_user_guilds_user_id', ['discord_user_id'])
@Index('idx_discord_user_guilds_guild_id', ['discord_guild_id'])
export class DiscordUserGuild {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 64 })
  discord_user_id!: string;

  @Column({ type: 'varchar', length: 50 })
  discord_guild_id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  synced_at!: Date;
}
