import { Check, Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn } from 'typeorm';

import { PendingArchiveReason, StudentStatus } from './enums.js';
import { Teacher } from './teacher.entity.js';

@Entity('students')
@ForeignKey(() => Teacher, ['teacher_id'], ['id'], {
  name: 'fk_students_teacher_id',
  onDelete: 'RESTRICT',
})
@Index('idx_students_teacher_id', ['teacher_id'])
@Index('idx_students_status', ['status'])
@Index('uq_students_teacher_codeforces_handle', ['teacher_id', 'codeforces_handle'], {
  unique: true,
  where: 'codeforces_handle IS NOT NULL',
})
@Check(
  'chk_students_pending_archive_reason',
  "(status = 'pending_archive' AND pending_archive_reason IS NOT NULL) OR (status <> 'pending_archive' AND pending_archive_reason IS NULL)",
)
@Check(
  'chk_students_archived_at',
  "(status = 'archived' AND archived_at IS NOT NULL) OR (status <> 'archived' AND archived_at IS NULL)",
)
export class Student {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  teacher_id!: number;

  @Column({ type: 'varchar', length: 255 })
  full_name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  codeforces_handle!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  discord_username!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  discord_user_id!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({
    type: 'enum',
    enum: StudentStatus,
    enumName: 'student_status',
    default: StudentStatus.Active,
  })
  status!: StudentStatus;

  @Column({
    type: 'enum',
    enum: PendingArchiveReason,
    enumName: 'pending_archive_reason',
    nullable: true,
  })
  pending_archive_reason!: PendingArchiveReason | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  archived_at!: Date | null;

  isActive(): boolean {
    return this.status === StudentStatus.Active;
  }

  isPendingArchive(): boolean {
    return this.status === StudentStatus.PendingArchive;
  }

  isArchived(): boolean {
    return this.status === StudentStatus.Archived;
  }

  markPendingArchive(reason: PendingArchiveReason): void {
    this.status = StudentStatus.PendingArchive;
    this.pending_archive_reason = reason;
    this.archived_at = null;
  }

  archive(archivedAt: Date): void {
    this.status = StudentStatus.Archived;
    this.pending_archive_reason = null;
    this.archived_at = archivedAt;
  }

  reinstate(): void {
    this.status = StudentStatus.Active;
    this.pending_archive_reason = null;
    this.archived_at = null;
  }
}
