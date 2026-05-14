import { ClassStatus } from '../../../../entities/enums.js';
import { ServiceError } from '../../../../shared/errors/service.error.js';
import { extractGymIdFromLink } from '../../../../infrastructure/external/codeforces/codeforces-api.service.js';
import type { CreateTopicInput } from '../dto/TopicDto.js';
import type { DefaultCodeforcesGatewayFactory } from '../../infrastructure/codeforces/DefaultCodeforcesGatewayFactory.js';
import type { TopicWriteRepository } from '../../infrastructure/persistence/typeorm/TopicWriteRepository.js';

export class CreateTopicUseCase {
  constructor(
    private readonly topicWriteRepository: TopicWriteRepository,
    private readonly codeforcesGatewayFactory: DefaultCodeforcesGatewayFactory,
  ) {}

  async execute(teacherId: number, input: CreateTopicInput) {
    const classEntity = await this.topicWriteRepository.findClassById(input.class_id);
    if (!classEntity) {
      throw new ServiceError('class not found', 404);
    }

    if (classEntity.status !== ClassStatus.Active) {
      throw new ServiceError('class is archived', 409);
    }

    const teacher = await this.topicWriteRepository.findTeacherById(teacherId);
    if (!teacher) {
      throw new ServiceError('teacher not found', 404);
    }

    const gymId = extractGymIdFromLink(input.gym_link);
    if (!gymId) {
      throw new ServiceError('gym_link must contain a valid gym id', 400);
    }

    const codeforces = this.codeforcesGatewayFactory.create(
      this.topicWriteRepository.resolveTeacherCodeforcesCredentials(teacher),
    );
    const gymMetadata = await codeforces.fetchGymMetadata(gymId);

    const existing = await this.topicWriteRepository.findTopicByGym(
      teacherId,
      input.class_id,
      gymMetadata.gym_id,
    );

    if (existing) {
      existing.title = gymMetadata.title;
      existing.gym_link = input.gym_link;
      existing.closed_at = null;
      existing.pull_interval_minutes = input.pull_interval_minutes ?? existing.pull_interval_minutes;
      return this.topicWriteRepository.saveTopic(existing);
    }

    const topic = this.topicWriteRepository.createTopic({
      teacher_id: teacherId,
      class_id: input.class_id,
      title: gymMetadata.title,
      gym_link: input.gym_link,
      gym_id: gymMetadata.gym_id,
      closed_at: null,
      pull_interval_minutes: input.pull_interval_minutes ?? 60,
      last_pulled_at: null,
    });

    return this.topicWriteRepository.saveTopic(topic);
  }
}
