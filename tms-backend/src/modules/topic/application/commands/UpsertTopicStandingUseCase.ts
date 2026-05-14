import { ServiceError } from '../../../../shared/errors/service.error.js';
import type { UpsertTopicStandingInput } from '../dto/TopicDto.js';
import type { TypeOrmTopicWriter } from '../../infrastructure/persistence/typeorm/TypeOrmTopicWriter.js';

export class UpsertTopicStandingUseCase {
  constructor(private readonly topicWriter: TypeOrmTopicWriter) {}

  async execute(teacherId: number, topicId: number, input: UpsertTopicStandingInput) {
    const topic = await this.topicWriter.findOwnedTopic(teacherId, topicId);
    if (!topic) {
      throw new ServiceError('topic not found', 404);
    }

    const student = await this.topicWriter.findOwnedStudent(teacherId, input.student_id);
    if (!student) {
      throw new ServiceError('student not found', 404);
    }

    const problem = await this.topicWriter.findOwnedTopicProblem(
      teacherId,
      topicId,
      input.problem_id,
    );
    if (!problem) {
      throw new ServiceError('topic problem not found', 404);
    }

    const existing = await this.topicWriter.findTopicStanding(
      teacherId,
      topic.id,
      input.student_id,
      input.problem_id,
    );

    if (existing) {
      existing.solved = input.solved;
      existing.penalty_minutes = input.penalty_minutes ?? null;
      existing.pulled_at = input.pulled_at ?? new Date();
      return this.topicWriter.saveTopicStanding(existing);
    }

    const standing = this.topicWriter.createTopicStanding({
      teacher_id: teacherId,
      topic_id: topic.id,
      student_id: input.student_id,
      problem_id: input.problem_id,
      solved: input.solved,
      penalty_minutes: input.penalty_minutes ?? null,
      pulled_at: input.pulled_at ?? new Date(),
    });

    return this.topicWriter.saveTopicStanding(standing);
  }
}
