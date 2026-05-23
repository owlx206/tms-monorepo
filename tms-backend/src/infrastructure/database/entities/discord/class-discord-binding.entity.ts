import { Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { Teacher } from '../teacher.entity.js';
import { Class } from '../class.entity.js';

@Entity('class_discord_bindings')
@ForeignKey(() => Teacher, ['teacher_id'], ['id'], {
  name: 'fk_class_discord_bindings_teacher_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Class, ['class_id'], ['id'], {
  name: 'fk_class_discord_bindings_class_id',
  onDelete: 'NO ACTION',
})
@Unique('uq_class_discord_bindings_class_id', ['class_id'])
@Unique('uq_class_discord_bindings_guild_id', ['teacher_id', 'discord_guild_id'])
@Index('idx_class_discord_bindings_teacher_id', ['teacher_id'])
export class ClassDiscordBinding {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  teacher_id!: number;

  @Column({ type: 'int' })
  class_id!: number;

  @Column({ type: 'varchar', length: 50 })
  discord_guild_id!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  attendance_voice_channel_id!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  notification_channel_id!: string | null;
}
