import { Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { credentialTransformer } from '../../security/credential-transformer.js';
import { Teacher } from './teacher.entity.js';

@Entity('teacher_codeforces_credential')
@ForeignKey(() => Teacher, ['teacher_id'], ['id'], {
  name: 'fk_teacher_codeforces_credential_teacher_id',
  onDelete: 'CASCADE',
})
@Unique('uq_teacher_codeforces_credential_teacher_id', ['teacher_id'])
@Index('idx_teacher_codeforces_credential_teacher_id', ['teacher_id'])
export class TeacherCodeforcesCredential {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  teacher_id!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  codeforces_handle!: string | null;

  @Column({ type: 'text', nullable: true, transformer: credentialTransformer })
  codeforces_api_key!: string | null;

  @Column({ type: 'text', nullable: true, transformer: credentialTransformer })
  codeforces_api_secret!: string | null;

  @Column({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  created_at!: Date;

  @Column({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  updated_at!: Date;
}
