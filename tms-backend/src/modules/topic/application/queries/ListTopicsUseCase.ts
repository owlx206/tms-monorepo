import type { Topic } from '../../infrastructure/persistence/typeorm/entities/topic.entity.js';
import type { ListTopicsReader, TopicListQuery, TopicStatusFilter } from '../../contracts/types.js';

function normalizeTopicStatus(topic: { closed_at: Date | null }): TopicStatusFilter {
  return topic.closed_at ? 'closed' : 'active';
}

export class ListTopicsUseCase {
  constructor(private readonly topics: ListTopicsReader<Topic>) {}

  async execute(teacherId: number, filters: TopicListQuery) {
    const topics = await this.topics.listTopicsForTeacher(teacherId, filters);

    return topics
      .map((topic) => ({
        ...topic,
        status: normalizeTopicStatus(topic),
      }))
      .filter((topic) => !filters.status || topic.status === filters.status);
  }
}
