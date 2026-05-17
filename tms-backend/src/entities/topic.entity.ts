import { Check, Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn } from 'typeorm';

import { Class } from './class.entity.js';
import { Teacher } from './teacher.entity.js';

const LEGACY_TOPIC_CLOSED_AT_COLUMN = ['expires', 'at'].join('_');

@Entity('topics')
@ForeignKey(() => Teacher, ['teacher_id'], ['id'], {
  name: 'fk_topics_teacher_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Class, ['class_id'], ['id'], {
  name: 'fk_topics_class_id',
  onDelete: 'NO ACTION',
})
@Index('idx_topics_teacher_id', ['teacher_id'])
@Index('idx_topics_class_id', ['class_id'])
@Index('idx_topics_closed_at', ['closed_at'])
@Check('chk_topics_pull_interval_minutes', 'pull_interval_minutes > 0')
export class Topic {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  teacher_id!: number;

  @Column({ type: 'int' })
  class_id!: number;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  gym_link!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  gym_id!: string | null;

  @Column({ name: LEGACY_TOPIC_CLOSED_AT_COLUMN, type: 'datetimeoffset', nullable: true })
  closed_at!: Date | null;

  @Column({ type: 'int', default: 60 })
  pull_interval_minutes!: number;

  @Column({ type: 'datetimeoffset', nullable: true })
  last_pulled_at!: Date | null;

  @Column({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  created_at!: Date;
}
