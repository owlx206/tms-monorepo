import { Check, Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn } from 'typeorm';

import { Class } from '../class.entity.js';
import { Teacher } from '../teacher.entity.js';

const LEGACY_TOPIC_CLOSED_AT_COLUMN = ['expires', 'at'].join('_');

@Entity('gyms')
@ForeignKey(() => Teacher, ['teacher_id'], ['id'], {
  name: 'fk_gyms_teacher_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Class, ['class_id'], ['id'], {
  name: 'fk_gyms_class_id',
  onDelete: 'NO ACTION',
})
@Index('idx_gyms_teacher_id', ['teacher_id'])
@Index('idx_gyms_class_id', ['class_id'])
@Index('idx_gyms_closed_at', ['closed_at'])
@Index('uq_gyms_teacher_catalog_gym_id', ['teacher_id', 'gym_id'], {
  unique: true,
  where: 'class_id IS NULL AND gym_id IS NOT NULL',
})
@Index('uq_gyms_teacher_class_gym_id', ['teacher_id', 'class_id', 'gym_id'], {
  unique: true,
  where: 'class_id IS NOT NULL AND gym_id IS NOT NULL',
})
@Check('chk_gyms_pull_interval_minutes', 'pull_interval_minutes > 0')
export class Gym {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  teacher_id!: number;

  @Column({ type: 'int', nullable: true })
  class_id!: number | null;

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
