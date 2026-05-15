import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('sysadmin_discord_bot_credentials')
@Unique('uq_sysadmin_discord_bot_credentials_singleton', ['singleton_key'])
export class SysadminDiscordBotCredential {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 32, default: 'default' })
  singleton_key!: string;

  @Column({ type: 'text' })
  bot_token!: string;

  @Column({ type: 'varchar', length: 64 })
  client_id!: string;

  @Column({ type: 'text', default: '' })
  client_secret!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  permissions!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  scopes!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'unknown' })
  bot_health_status!: 'unknown' | 'healthy' | 'unhealthy';

  @Column({ type: 'text', nullable: true })
  bot_health_message!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  bot_health_checked_at!: Date | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at!: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at!: Date;
}
