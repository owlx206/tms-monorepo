import { Teacher } from '../../infrastructure/persistence/typeorm/entities/teacher.entity.js';
import type { TopicBotConfig } from '../../../topic/infrastructure/persistence/typeorm/entities/topic-bot-config.entity.js';
import type { AuthTeacher } from '../../contracts/types.js';

export function toAuthTeacher(teacher: Teacher, topicBotConfig?: TopicBotConfig | null): AuthTeacher {
  return {
    id: teacher.id,
    username: teacher.username,
    role: teacher.role,
    is_active: teacher.is_active,
    codeforces_api_key: topicBotConfig?.codeforces_api_key ?? null,
    codeforces_api_secret: topicBotConfig?.codeforces_api_secret ?? null,
    discord_username: teacher.discord_username,
    discord_user_id: teacher.discord_user_id,
    discord_verified_at: teacher.discord_verified_at,
    created_at: teacher.created_at,
  };
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
