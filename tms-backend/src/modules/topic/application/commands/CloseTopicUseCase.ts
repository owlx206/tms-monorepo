import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { TypeOrmTopicWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

export class CloseTopicUseCase {
  constructor(private readonly topicWriter: TypeOrmTopicWriter) {}

  async execute(teacherId: number, topicId: number) {
    const topic = await this.topicWriter.findOwnedTopic(teacherId, topicId);
    if (!topic) {
      throw new HttpError('topic not found', 404);
    }

    topic.closed_at = new Date();
    return this.topicWriter.saveTopic(topic);
  }
}
