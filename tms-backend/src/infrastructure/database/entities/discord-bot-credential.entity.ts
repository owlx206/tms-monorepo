import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { credentialTransformer } from '../../security/credential-transformer.js';

@Entity('discord_bot_credentials')
@Unique('uq_discord_bot_credentials_singleton', ['singleton_key'])
export class DiscordBotCredential {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 32, default: 'default' })
  singleton_key!: string;

  @Column({ type: 'text', transformer: credentialTransformer })
  bot_token!: string;

  @Column({ type: 'varchar', length: 64 })
  client_id!: string;

  @Column({ type: 'text', default: '', transformer: credentialTransformer })
  client_secret!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  permissions!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  scopes!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'unknown' })
  bot_health_status!: 'unknown' | 'healthy' | 'unhealthy';

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  bot_health_message!: string | null;

  @Column({ type: 'datetimeoffset', nullable: true })
  bot_health_checked_at!: Date | null;

  @Column({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  created_at!: Date;

  @Column({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  updated_at!: Date;
}
                                           
