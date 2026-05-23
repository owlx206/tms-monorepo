import { Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { Student } from './student.entity.js';

@Entity('student_discord_credential')
@ForeignKey(() => Student, ['student_id'], ['id'], {
  name: 'fk_student_discord_credential_student_id',
  onDelete: 'CASCADE',
})
@Unique('uq_student_discord_credential_student_id', ['student_id'])
@Index('idx_student_discord_credential_student_id', ['student_id'])
@Index('idx_student_discord_credential_user_id', ['discord_user_id'])
export class StudentDiscordCredential {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  student_id!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  discord_username!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  discord_user_id!: string | null;

  @Column({ type: 'text', nullable: true })
  discord_access_token!: string | null;

  @Column({ type: 'text', nullable: true })
  discord_refresh_token!: string | null;

  @Column({ type: 'datetimeoffset', nullable: true })
  discord_token_expires_at!: Date | null;

  @Column({ type: 'datetimeoffset', nullable: true })
  discord_authorized_at!: Date | null;
}
