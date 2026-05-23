import { ClassStatus, type BindClassGymInput } from '../../contracts/types.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { TypeOrmGymWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

export class BindClassGymUseCase {
  constructor(private readonly gymWriter: TypeOrmGymWriter) {}

  async execute(teacherId: number, classId: number, input: BindClassGymInput) {
    const classEntity = await this.gymWriter.findClassById(classId);
    if (!classEntity) {
      throw new HttpError('class not found', 404);
    }

    if (classEntity.status !== ClassStatus.Active) {
      throw new HttpError('class is archived', 409);
    }

    // Check if already bound to this class
    const existing = await this.gymWriter.findClassGymByCodeforcesGymId(teacherId, classId, input.gym_id);
    if (existing) {
      return existing;
    }

    // Keep the catalog row and create a class-bound gym row from it.
    const catalogGym = await this.gymWriter.findCatalogGym(teacherId, input.gym_id);
    if (!catalogGym) {
      throw new HttpError('codeforces gym not synced yet', 404);
    }

    return this.gymWriter.saveGym(this.gymWriter.createGym({
      teacher_id: teacherId,
      class_id: classId,
      gym_id: catalogGym.gym_id,
      title: catalogGym.title,
      gym_link: catalogGym.gym_link,
      pull_interval_minutes: input.pull_interval_minutes ?? catalogGym.pull_interval_minutes,
      last_pulled_at: catalogGym.last_pulled_at,
      closed_at: null,
    }));
  }
}
