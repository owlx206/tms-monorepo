import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { AddTopicProblemInput } from '../../contracts/types.js';
import type { TypeOrmTopicWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

export class AddTopicProblemUseCase {
  constructor(private readonly topicWriter: TypeOrmTopicWriter) {}

  async execute(teacherId: number, topicId: number, input: AddTopicProblemInput) {
    const topic = await this.topicWriter.findOwnedTopic(teacherId, topicId);
    if (!topic) {
      throw new HttpError('topic not found', 404);
    }

    const existing = await this.topicWriter.findTopicProblemByIndex(topicId, input.problem_index);
    if (existing) {
      existing.problem_name = input.problem_name ?? null;
      return this.topicWriter.saveTopicProblem(existing);
    }

    const problem = this.topicWriter.createTopicProblem({
      teacher_id: teacherId,
      topic_id: topic.id,
      problem_index: input.problem_index,
      problem_name: input.problem_name ?? null,
    });

    return this.topicWriter.saveTopicProblem(problem);
  }
}
