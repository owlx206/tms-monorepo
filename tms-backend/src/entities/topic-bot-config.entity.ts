import { Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { credentialTransformer } from '../infrastructure/security/credential-transformer.js';
import { Teacher } from './teacher.entity.js';

@Entity('topic_bot_configs')
@ForeignKey(() => Teacher, ['teacher_id'], ['id'], {
  name: 'fk_topic_bot_configs_teacher_id',
  onDelete: 'CASCADE',
})
@Unique('uq_topic_bot_configs_teacher_id', ['teacher_id'])
@Index('idx_topic_bot_configs_teacher_id', ['teacher_id'])
export class TopicBotConfig {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  teacher_id!: number;

  @Column({ type: 'text', nullable: true, transformer: credentialTransformer })
  codeforces_api_key!: string | null;

  @Column({ type: 'text', nullable: true, transformer: credentialTransformer })
  codeforces_api_secret!: string | null;

  @Column({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  created_at!: Date;

  @Column({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  updated_at!: Date;
}
