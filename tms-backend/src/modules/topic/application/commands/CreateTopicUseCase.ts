import { ClassStatus } from '../../../classroom/contracts/types.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';
import {
  CodeforcesClient,
  extractGymIdFromLink,
} from '../../../../infrastructure/external/codeforces/codeforces-api.service.js';
import type { CreateTopicInput } from '../../contracts/types.js';
import type { TypeOrmTopicWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

export class CreateTopicUseCase {
  constructor(
    private readonly topicWriter: TypeOrmTopicWriter,
  ) {}

  async execute(teacherId: number, input: CreateTopicInput) {
    const classEntity = await this.topicWriter.findClassById(input.class_id);
    if (!classEntity) {
      throw new HttpError('class not found', 404);
    }

    if (classEntity.status !== ClassStatus.Active) {
      throw new HttpError('class is archived', 409);
    }

    const teacher = await this.topicWriter.findTeacherById(teacherId);
    if (!teacher) {
      throw new HttpError('teacher not found', 404);
    }

    const gymId = extractGymIdFromLink(input.gym_link);
    if (!gymId) {
      throw new HttpError('gym_link must contain a valid gym id', 400);
    }

    const codeforces = new CodeforcesClient(await this.topicWriter.resolveTopicBotCodeforcesCredentials(teacherId));
    const gymMetadata = await codeforces.fetchGymMetadata(gymId);

    const existing = await this.topicWriter.findTopicByGym(
      teacherId,
      input.class_id,
      gymMetadata.gym_id,
    );

    if (existing) {
      existing.title = gymMetadata.title;
      existing.gym_link = input.gym_link;
      existing.closed_at = null;
      existing.pull_interval_minutes = input.pull_interval_minutes ?? existing.pull_interval_minutes;
      return this.topicWriter.saveTopic(existing);
    }

    const topic = this.topicWriter.createTopic({
      teacher_id: teacherId,
      class_id: input.class_id,
      title: gymMetadata.title,
      gym_link: input.gym_link,
      gym_id: gymMetadata.gym_id,
      closed_at: null,
      pull_interval_minutes: input.pull_interval_minutes ?? 60,
      last_pulled_at: null,
    });

    return this.topicWriter.saveTopic(topic);
  }
}
