import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { Teacher } from '../../../../../entities/teacher.entity.js';
import { TopicBotConfig } from '../../../../../entities/topic-bot-config.entity.js';
import { ClassDiscordBinding } from '../../../../../entities/class-guild.entity.js';
import { DiscordGuildChannelCache } from '../../../../../entities/discord-channel.entity.js';
import { DiscordUserGuild } from '../../../../../entities/discord-guild.entity.js';

export class TypeOrmTeacherWriter {
  create(input: Partial<Teacher>): Teacher {
    return AppDataSource.getRepository(Teacher).create(input);
  }

  save(teacher: Teacher): Promise<Teacher> {
    return AppDataSource.getRepository(Teacher).save(teacher);
  }

  findById(teacherId: number): Promise<Teacher | null> {
    return AppDataSource.getRepository(Teacher).findOneBy({ id: teacherId });
  }

  findByUsername(username: string): Promise<Teacher | null> {
    return AppDataSource.getRepository(Teacher).findOneBy({ username });
  }

  findTopicBotConfig(teacherId: number): Promise<TopicBotConfig | null> {
    return AppDataSource.getRepository(TopicBotConfig).findOneBy({ teacher_id: teacherId });
  }

  async saveTopicBotConfig(
    teacherId: number,
    input: {
      codeforces_api_key?: string | null;
      codeforces_api_secret?: string | null;
    },
  ): Promise<TopicBotConfig | null> {
    const hasApiKeyInput = input.codeforces_api_key !== undefined;
    const hasApiSecretInput = input.codeforces_api_secret !== undefined;
    if (!hasApiKeyInput && !hasApiSecretInput) {
      return this.findTopicBotConfig(teacherId);
    }

    const repo = AppDataSource.getRepository(TopicBotConfig);
    const existing = await repo.findOneBy({ teacher_id: teacherId });
    const config = existing ?? repo.create({ teacher_id: teacherId });

    if (hasApiKeyInput) {
      config.codeforces_api_key = input.codeforces_api_key?.trim() || null;
    }

    if (hasApiSecretInput) {
      config.codeforces_api_secret = input.codeforces_api_secret?.trim() || null;
    }

    config.updated_at = new Date();
    return repo.save(config);
  }

  async clearDiscordWorkspaceData(teacherId: number, discordUserId: string | null): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      await manager.getRepository(ClassDiscordBinding).delete({ teacher_id: teacherId });

      if (discordUserId) {
        await manager.getRepository(DiscordGuildChannelCache).delete({ discord_user_id: discordUserId });
        await manager.getRepository(DiscordUserGuild).delete({ discord_user_id: discordUserId });
      }
    });
  }
}
