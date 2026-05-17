import { In, type EntityManager } from 'typeorm';

import { Teacher } from '../../../../../entities/teacher.entity.js';
import { TopicBotConfig } from '../../../../../entities/topic-bot-config.entity.js';
import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import type { AdminTeacher } from '../../../application/dto/AdminDto.js';

export class TypeOrmTeacherReader {
  constructor(private readonly manager: EntityManager = AppDataSource.manager) {}

  async listAdminTeachers(): Promise<AdminTeacher[]> {
    const teachers = await this.manager.getRepository(Teacher).find({
      order: {
        created_at: 'DESC',
      },
    });
    const topicBotConfigs = teachers.length > 0
      ? await this.manager.getRepository(TopicBotConfig).findBy({
        teacher_id: In(teachers.map((teacher) => teacher.id)),
      })
      : [];
    const topicBotConfigByTeacherId = new Map(
      topicBotConfigs.map((config) => [config.teacher_id, config]),
    );

    return teachers.map((teacher) => ({
      id: teacher.id,
      username: teacher.username,
      role: teacher.role,
      is_active: teacher.is_active,
      has_codeforces_api_key: Boolean(topicBotConfigByTeacherId.get(teacher.id)?.codeforces_api_key),
      has_codeforces_api_secret: Boolean(topicBotConfigByTeacherId.get(teacher.id)?.codeforces_api_secret),
      created_at: teacher.created_at,
    }));
  }
}
