import { Check, Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { Enrollment } from '../../../../../enrollment/infrastructure/persistence/typeorm/entities/enrollment.entity.js';
import { FeeRecordStatus } from '../../../../contracts/types.js';
import { Session } from '../../../../../classroom/infrastructure/persistence/typeorm/entities/session.entity.js';
import { Student } from '../../../../../enrollment/infrastructure/persistence/typeorm/entities/student.entity.js';
import { Teacher } from '../../../../../identity/infrastructure/persistence/typeorm/entities/teacher.entity.js';

@Entity('fee_records')
@ForeignKey(() => Teacher, ['teacher_id'], ['id'], {
  name: 'fk_fee_records_teacher_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Student, ['student_id'], ['id'], {
  name: 'fk_fee_records_student_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Session, ['session_id'], ['id'], {
  name: 'fk_fee_records_session_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Enrollment, ['enrollment_id'], ['id'], {
  name: 'fk_fee_records_enrollment_id',
  onDelete: 'NO ACTION',
})
@Unique('uq_fee_records_student_session', ['student_id', 'session_id'])
@Index('idx_fee_records_teacher_id', ['teacher_id'])
@Index('idx_fee_records_student_id', ['student_id'])
@Index('idx_fee_records_session_id', ['session_id'])
@Index('idx_fee_records_status', ['status'])
@Check('chk_fee_records_amount', 'amount > 0')
@Check(
  'chk_fee_records_cancelled',
  "(status = 'cancelled' AND cancelled_at IS NOT NULL) OR (status = 'active' AND cancelled_at IS NULL)",
)
export class FeeRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  teacher_id!: number;

  @Column({ type: 'int' })
  student_id!: number;

  @Column({ type: 'int' })
  session_id!: number;

  @Column({ type: 'int' })
  enrollment_id!: number;

  @Column({ type: 'numeric', precision: 12, scale: 0 })
  amount!: string;

  @Column({
    type: 'simple-enum',
    enum: FeeRecordStatus,
    enumName: 'fee_record_status',
    default: FeeRecordStatus.Active,
  })
  status!: FeeRecordStatus;

  @Column({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  created_at!: Date;

  @Column({ type: 'datetimeoffset', nullable: true })
  cancelled_at!: Date | null;

  isActive(): boolean {
    return this.status === FeeRecordStatus.Active;
  }

  isCancelled(): boolean {
    return this.status === FeeRecordStatus.Cancelled;
  }

  activate(input: {
    enrollment_id: number;
    amount: string;
  }): void {
    this.enrollment_id = input.enrollment_id;
    this.amount = input.amount;
    this.status = FeeRecordStatus.Active;
    this.cancelled_at = null;
  }

  cancel(cancelledAt: Date = new Date()): void {
    if (this.isCancelled()) {
      return;
    }

    this.status = FeeRecordStatus.Cancelled;
    this.cancelled_at = cancelledAt;
  }

  setStatus(status: FeeRecordStatus, changedAt: Date = new Date()): void {
    if (status === FeeRecordStatus.Active) {
      this.status = FeeRecordStatus.Active;
      this.cancelled_at = null;
      return;
    }

    this.cancel(changedAt);
  }
}
