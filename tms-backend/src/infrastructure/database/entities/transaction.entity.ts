import { Check, Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { TransactionType } from '../../../modules/finance/contracts/types.js';
import { Student } from './student.entity.js';
import { Teacher } from './teacher.entity.js';

@Entity('transactions')
@ForeignKey(() => Teacher, ['teacher_id'], ['id'], {
  name: 'fk_transactions_teacher_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Student, ['student_id'], ['id'], {
  name: 'fk_transactions_student_id',
  onDelete: 'NO ACTION',
})
@Index('idx_transactions_teacher_id', ['teacher_id'])
@Index('idx_transactions_student_id', ['student_id'])
@Index('idx_transactions_recorded_at', ['recorded_at'])
@Check('chk_transactions_amount_nonzero', 'amount <> 0')
@Check('chk_transactions_amount_sign', "([type] = 'payment' AND amount > 0) OR ([type] = 'refund' AND amount < 0)")
export class Transaction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  teacher_id!: number;

  @Column({ type: 'int' })
  student_id!: number;

  @Column({ type: 'numeric', precision: 12, scale: 0 })
  amount!: string;

  @Column({
    type: 'simple-enum',
    enum: TransactionType,
    enumName: 'transaction_type',
  })
  type!: TransactionType;

  @Column({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  recorded_at!: Date;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @UpdateDateColumn({ type: 'datetimeoffset' })
  updated_at!: Date;
}
