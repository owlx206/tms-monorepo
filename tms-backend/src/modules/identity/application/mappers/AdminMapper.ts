import { Teacher } from '../../../../entities/index.js';
import type { TopicBotConfig } from '../../../../entities/topic-bot-config.entity.js';
import type { AdminTeacher } from '../dto/AdminDto.js';

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
