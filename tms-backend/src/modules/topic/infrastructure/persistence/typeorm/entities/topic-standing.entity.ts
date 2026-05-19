import { Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { Student } from '../../../../../enrollment/infrastructure/persistence/typeorm/entities/student.entity.js';
import { Teacher } from '../../../../../identity/infrastructure/persistence/typeorm/entities/teacher.entity.js';
import { TopicProblem } from './topic-problem.entity.js';
import { Topic } from './topic.entity.js';

@Entity('topic_standings')
@ForeignKey(() => Teacher, ['teacher_id'], ['id'], {
  name: 'fk_topic_standings_teacher_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Topic, ['topic_id'], ['id'], {
  name: 'fk_topic_standings_topic_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Student, ['student_id'], ['id'], {
  name: 'fk_topic_standings_student_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => TopicProblem, ['problem_id'], ['id'], {
  name: 'fk_topic_standings_problem_id',
  onDelete: 'NO ACTION',
})
@Unique('uq_topic_standings_student_problem', ['topic_id', 'student_id', 'problem_id'])
@Index('idx_topic_standings_teacher_id', ['teacher_id'])
@Index('idx_topic_standings_topic_id', ['topic_id'])
@Index('idx_topic_standings_student_id', ['student_id'])
export class TopicStanding {
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
