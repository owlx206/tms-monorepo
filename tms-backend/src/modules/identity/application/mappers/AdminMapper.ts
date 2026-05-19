import { Teacher } from '../../infrastructure/persistence/typeorm/entities/teacher.entity.js';
import type { TopicBotConfig } from '../../../topic/infrastructure/persistence/typeorm/entities/topic-bot-config.entity.js';
import type { AdminTeacher } from '../../contracts/types.js';

export function toAdminTeacher(teacher: Teacher, topicBotConfig?: TopicBotConfig | null): AdminTeacher {
  return {
    id: teacher.id,
    username: teacher.username,
    role: teacher.role,
    is_active: teacher.is_active,
    has_codeforces_api_key: Boolean(topicBotConfig?.codeforces_api_key),
    has_codeforces_api_secret: Boolean(topicBotConfig?.codeforces_api_secret),
    created_at: teacher.created_at,
  };
}
