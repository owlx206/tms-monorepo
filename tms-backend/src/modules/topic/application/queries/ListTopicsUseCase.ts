import type { Topic } from '../../../../entities/topic.entity.js';
import type { TopicListQuery } from '../dto/TopicDto.js';

type TopicReader = {
  listTopicsForTeacher(teacherId: number, filters: { class_id?: number }): Promise<Topic[]>;
};

type TopicStatusFilter = 'active' | 'closed';

function normalizeTopicStatus(topic: { closed_at: Date | null }): TopicStatusFilter {
  return topic.closed_at ? 'closed' : 'active';
}

export class ListTopicsUseCase {
  constructor(private readonly topics: TopicReader) {}

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
