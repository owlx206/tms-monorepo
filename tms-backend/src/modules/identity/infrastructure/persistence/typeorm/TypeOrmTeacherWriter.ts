import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { Teacher } from '../../../../../entities/teacher.entity.js';
import { DiscordServer } from '../../../../../entities/discord-server.entity.js';
import { DiscordServerChannel } from '../../../../../entities/discord-server-channel.entity.js';
import { DiscordServerOwnership } from '../../../../../entities/discord-server-ownership.entity.js';

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

  async clearDiscordWorkspaceData(teacherId: number, discordUserId: string | null): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      await manager.getRepository(DiscordServer).delete({ teacher_id: teacherId });

      if (discordUserId) {
        await manager.getRepository(DiscordServerChannel).delete({ discord_user_id: discordUserId });
        await manager.getRepository(DiscordServerOwnership).delete({ discord_user_id: discordUserId });
      }
    });
  }
}
