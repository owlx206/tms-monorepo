import type { TypeOrmMessagingWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

export class UnbindClassDiscordGuildUseCase {
  constructor(private readonly messagingWriter: TypeOrmMessagingWriter) {}

  async execute(teacherId: number, classId: number) {
    const existing = await this.messagingWriter.findDiscordGuildByClass(teacherId, classId);

    if (!existing) {
      return null;
    }

    await this.messagingWriter.removeClassDiscordBinding(existing);
    return null;
  }
}
