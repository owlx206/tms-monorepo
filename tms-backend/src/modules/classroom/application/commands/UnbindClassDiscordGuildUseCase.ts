import type { TypeOrmClassroomDiscordWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

export class UnbindClassDiscordGuildUseCase {
  constructor(private readonly classroomDiscordWriter: TypeOrmClassroomDiscordWriter) {}

  async execute(teacherId: number, classId: number): Promise<null> {
    const existing = await this.classroomDiscordWriter.findDiscordGuildByClass(teacherId, classId);

    if (!existing) {
      return null;
    }

    await this.classroomDiscordWriter.removeClassDiscordBinding(existing);
    return null;
  }
}
