import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { TypeOrmGymWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

export class UnbindClassGymUseCase {
  constructor(private readonly gymWriter: TypeOrmGymWriter) {}

  async execute(teacherId: number, classId: number, gymId: number) {
    const gym = await this.gymWriter.findOwnedClassGym(teacherId, classId, gymId);
    if (!gym) {
      throw new HttpError('gym binding not found', 404);
    }

    gym.class_id = null;
    return this.gymWriter.saveGym(gym);
  }
}
