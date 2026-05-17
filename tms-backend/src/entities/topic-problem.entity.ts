import { Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { Teacher } from './teacher.entity.js';
import { Topic } from './topic.entity.js';

@Entity('topic_problems')
@ForeignKey(() => Teacher, ['teacher_id'], ['id'], {
  name: 'fk_topic_problems_teacher_id',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => Topic, ['topic_id'], ['id'], {
  name: 'fk_topic_problems_topic_id',
  onDelete: 'NO ACTION',
})
@Unique('uq_topic_problems_topic_index', ['topic_id', 'problem_index'])
@Index('idx_topic_problems_teacher_id', ['teacher_id'])
@Index('idx_topic_problems_topic_id', ['topic_id'])
export class TopicProblem {
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
