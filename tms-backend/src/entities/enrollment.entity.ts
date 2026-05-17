import { Check, Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn } from 'typeorm';

import { Class } from './class.entity.js';
import { Student } from './student.entity.js';
import { Teacher } from './teacher.entity.js';

@Entity('enrollments')
@ForeignKey(() => Teacher, ['teacher_id'], ['id'], {
  name: 'fk_enrollments_teacher_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Student, ['student_id'], ['id'], {
  name: 'fk_enrollments_student_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Class, ['class_id'], ['id'], {
  name: 'fk_enrollments_class_id',
  onDelete: 'NO ACTION',
})
@Index('uq_enrollments_one_active_per_student', ['teacher_id', 'student_id'], {
  unique: true,
  where: 'unenrolled_at IS NULL',
})
@Index('idx_enrollments_teacher_id', ['teacher_id'])
@Index('idx_enrollments_student_id', ['student_id'])
@Index('idx_enrollments_class_id', ['class_id'])
@Check('chk_enrollments_dates', 'unenrolled_at IS NULL OR unenrolled_at > enrolled_at')
export class Enrollment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  teacher_id!: number;

  @Column({ type: 'int' })
  student_id!: number;

  @Column({ type: 'int' })
  class_id!: number;

  @Column({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  enrolled_at!: Date;

  @Column({ type: 'datetimeoffset', nullable: true })
  unenrolled_at!: Date | null;
}
