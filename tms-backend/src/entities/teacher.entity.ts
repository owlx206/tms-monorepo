import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TeacherRole } from './enums.js';

@Entity('teachers')
@Unique('uq_teachers_username', ['username'])
export class Teacher {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  username!: string;

  @Column({ type: 'text' })
  password_hash!: string;

  @Column({ type: 'simple-enum', enum: TeacherRole, default: TeacherRole.Teacher })
  role!: TeacherRole;

  @Column({ type: 'bit', default: true })
  is_active!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  discord_username!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  discord_user_id!: string | null;

  @Column({ type: 'datetimeoffset', nullable: true })
  discord_verified_at!: Date | null;

  @Column({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  created_at!: Date;
}
