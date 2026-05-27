import { Check, Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { AttendanceSource, AttendanceStatus } from '../../../modules/classroom/contracts/types.js';
import { Session } from './session.entity.js';
import { Student } from './student.entity.js';
import { Teacher } from './teacher.entity.js';

@Entity('attendance')
@ForeignKey(() => Teacher, ['teacher_id'], ['id'], {
  name: 'fk_attendance_teacher_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Session, ['session_id'], ['id'], {
  name: 'fk_attendance_session_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Student, ['student_id'], ['id'], {
  name: 'fk_attendance_student_id',
  onDelete: 'NO ACTION',
})
@Unique('uq_attendance_session_student', ['session_id', 'student_id'])
@Index('idx_attendance_teacher_id', ['teacher_id'])
@Index('idx_attendance_session_id', ['session_id'])
@Index('idx_attendance_student_id', ['student_id'])
@Check(
  'chk_attendance_override',
  "(source = 'manual' AND overridden_at IS NOT NULL) OR (source IN ('bot', 'system') AND overridden_at IS NULL)",
)
export class Attendance {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  teacher_id!: number;

  @Column({ type: 'int' })
  session_id!: number;

  @Column({ type: 'int' })
  student_id!: number;

  @Column({
    type: 'simple-enum',
    enum: AttendanceStatus,
    enumName: 'attendance_status',
  })
  status!: AttendanceStatus;

  @Column({
    type: 'simple-enum',
    enum: AttendanceSource,
    enumName: 'attendance_source',
    default: AttendanceSource.System,
  })
  source!: AttendanceSource;

  @Column({ type: 'datetimeoffset', nullable: true })
  overridden_at!: Date | null;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  notes!: string | null;
}
