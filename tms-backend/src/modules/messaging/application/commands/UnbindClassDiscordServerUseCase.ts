import type { TypeOrmMessagingWriter } from '../../infrastructure/persistence/typeorm/TypeOrmMessagingWriter.js';

export class UnbindClassDiscordServerUseCase {
  constructor(private readonly messagingWriter: TypeOrmMessagingWriter) {}

  async execute(teacherId: number, classId: number) {
    const existing = await this.messagingWriter.findDiscordServerByClass(teacherId, classId);

    if (!existing) {
      return null;
    }

    await this.messagingWriter.removeDiscordServer(existing);
    return null;
  }
}
