import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { AddGymProblemInput } from '../../contracts/types.js';
import type { TypeOrmGymWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

export class AddGymProblemUseCase {
  constructor(private readonly gymWriter: TypeOrmGymWriter) {}

  async execute(teacherId: number, classId: number, gymId: number, input: AddGymProblemInput) {
    const gym = await this.gymWriter.findOwnedClassGym(teacherId, classId, gymId);
    if (!gym) {
      throw new HttpError('gym not found', 404);
    }

    const existing = await this.gymWriter.findGymProblemByIndex(gymId, input.problem_index);
    if (existing) {
      existing.problem_name = input.problem_name ?? null;
      return this.gymWriter.saveGymProblem(existing);
    }

    const problem = this.gymWriter.createGymProblem({
      teacher_id: teacherId,
      topic_id: gym.id,
      problem_index: input.problem_index,
      problem_name: input.problem_name ?? null,
    });

    return this.gymWriter.saveGymProblem(problem);
  }
}
