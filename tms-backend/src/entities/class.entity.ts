import { Check, Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn } from 'typeorm';

import { ClassStatus } from './enums.js';
import { Teacher } from './teacher.entity.js';

@Entity('classes')
@ForeignKey(() => Teacher, ['teacher_id'], ['id'], {
  name: 'fk_classes_teacher_id',
  onDelete: 'NO ACTION',
})
@Index('idx_classes_teacher_id', ['teacher_id'])
@Index('idx_classes_status', ['status'])
@Check('chk_classes_fee_per_session', 'fee_per_session >= 0')
@Check(
  'chk_classes_archived_at',
  "(status = 'archived' AND archived_at IS NOT NULL) OR (status = 'active' AND archived_at IS NULL)",
)
export class Class {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  teacher_id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'numeric', precision: 12, scale: 0 })
  fee_per_session!: string;

  @Column({
    type: 'simple-enum',
    enum: ClassStatus,
    enumName: 'class_status',
    default: ClassStatus.Active,
  })
  status!: ClassStatus;

  @Column({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  created_at!: Date;

  @Column({ type: 'datetimeoffset', nullable: true })
  archived_at!: Date | null;
}
