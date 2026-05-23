import { Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { Teacher } from '../teacher.entity.js';
import { Gym } from './gym.entity.js';

@Entity('gym_problems')
@ForeignKey(() => Teacher, ['teacher_id'], ['id'], {
  name: 'fk_gym_problems_teacher_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Gym, ['topic_id'], ['id'], {
  name: 'fk_gym_problems_gym_id',
  onDelete: 'NO ACTION',
})
@Unique('uq_gym_problems_gym_index', ['topic_id', 'problem_index'])
@Index('idx_gym_problems_teacher_id', ['teacher_id'])
@Index('idx_gym_problems_gym_id', ['topic_id'])
export class GymProblem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  teacher_id!: number;

  @Column({ type: 'int' })
  topic_id!: number;

  @Column({ type: 'varchar', length: 10 })
  problem_index!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  problem_name!: string | null;
}
