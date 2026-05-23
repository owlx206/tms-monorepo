import { Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { Student } from '../student.entity.js';
import { Teacher } from '../teacher.entity.js';
import { GymProblem } from './gym-problem.entity.js';
import { Gym } from './gym.entity.js';

@Entity('gym_standings')
@ForeignKey(() => Teacher, ['teacher_id'], ['id'], {
  name: 'fk_gym_standings_teacher_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Gym, ['topic_id'], ['id'], {
  name: 'fk_gym_standings_gym_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Student, ['student_id'], ['id'], {
  name: 'fk_gym_standings_student_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => GymProblem, ['problem_id'], ['id'], {
  name: 'fk_gym_standings_problem_id',
  onDelete: 'NO ACTION',
})
@Unique('uq_gym_standings_student_problem', ['topic_id', 'student_id', 'problem_id'])
@Index('idx_gym_standings_teacher_id', ['teacher_id'])
@Index('idx_gym_standings_gym_id', ['topic_id'])
@Index('idx_gym_standings_student_id', ['student_id'])
export class GymStanding {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  teacher_id!: number;

  @Column({ type: 'int' })
  topic_id!: number;

  @Column({ type: 'int' })
  student_id!: number;

  @Column({ type: 'int' })
  problem_id!: number;

  @Column({ type: 'bit', default: false })
  solved!: boolean;

  @Column({ type: 'int', nullable: true })
  penalty_minutes!: number | null;

  @Column({ type: 'datetimeoffset', default: () => 'SYSDATETIMEOFFSET()' })
  pulled_at!: Date;
}
