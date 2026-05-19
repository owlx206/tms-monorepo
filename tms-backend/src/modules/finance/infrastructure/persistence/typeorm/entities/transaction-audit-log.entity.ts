import { Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn } from 'typeorm';

import { TransactionType } from '../../../../contracts/types.js';
import { Student } from '../../../../../enrollment/infrastructure/persistence/typeorm/entities/student.entity.js';
import { Teacher } from '../../../../../identity/infrastructure/persistence/typeorm/entities/teacher.entity.js';
import { Transaction } from './transaction.entity.js';

@Entity('transaction_audit_logs')
@ForeignKey(() => Teacher, ['teacher_id'], ['id'], {
  name: 'fk_transaction_audit_logs_teacher_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Transaction, ['transaction_id'], ['id'], {
  name: 'fk_transaction_audit_logs_transaction_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Student, ['old_student_id'], ['id'], {
  name: 'fk_transaction_audit_logs_old_student_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Student, ['new_student_id'], ['id'], {
  name: 'fk_transaction_audit_logs_new_student_id',
  onDelete: 'NO ACTION',
})
@Index('idx_transaction_audit_logs_teacher_id', ['teacher_id'])
@Index('idx_transaction_audit_logs_transaction_id', ['transaction_id'])
@Index('idx_transaction_audit_logs_created_at', ['created_at'])
export class TransactionAuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  teacher_id!: number;

  @Column({ type: 'int' })
  transaction_id!: number;

  @Column({ type: 'int' })
  old_student_id!: number;

  @Column({ type: 'int' })
  new_student_id!: number;

  @Column({ type: 'numeric', precision: 12, scale: 0 })
  old_amount!: string;

  @Column({ type: 'numeric', precision: 12, scale: 0 })
  new_amount!: string;

  @Column({
    type: 'simple-enum',
    enum: TransactionType,
    enumName: 'transaction_type',
  })
  old_type!: TransactionType;

  @Column({
    type: 'simple-enum',
    enum: TransactionType,
    enumName: 'transaction_type',
  })
  new_type!: TransactionType;

  @Column({ type: 'datetimeoffset' })
  old_recorded_at!: Date;

  @Column({ type: 'datetimeoffset' })
  new_recorded_at!: Date;

  @Column({ type: 'text', nullable: true })
  old_notes!: string | null;

  @Column({ type: 'text', nullable: true })
  new_notes!: string | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  created_at!: Date;
}
