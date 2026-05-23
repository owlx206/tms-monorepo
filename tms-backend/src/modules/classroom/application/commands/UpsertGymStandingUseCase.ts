import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { UpsertGymStandingInput } from '../../contracts/types.js';
import type { TypeOrmGymWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

export class UpsertGymStandingUseCase {
  constructor(private readonly gymWriter: TypeOrmGymWriter) {}

  async execute(teacherId: number, classId: number, gymId: number, input: UpsertGymStandingInput) {
    const gym = await this.gymWriter.findOwnedClassGym(teacherId, classId, gymId);
    if (!gym) {
      throw new HttpError('gym not found', 404);
    }

    if (gym.class_id === null) {
      throw new HttpError('gym is not bound to a class', 409);
    }

    const student = await this.gymWriter.findOwnedStudent(teacherId, input.student_id);
    if (!student) {
      throw new HttpError('student not found', 404);
    }

    const enrollment = await this.gymWriter.findActiveEnrollment(teacherId, gym.class_id, student.id);
    if (!enrollment) {
      throw new HttpError('student is not enrolled in gym class', 409);
    }

    const problem = await this.gymWriter.findOwnedGymProblem(
      teacherId,
      gymId,
      input.problem_id,
    );
    if (!problem) {
      throw new HttpError('gym problem not found', 404);
    }

    const existing = await this.gymWriter.findGymStanding(
      teacherId,
      gym.id,
      input.student_id,
      input.problem_id,
    );

    if (existing) {
      existing.solved = input.solved;
      existing.penalty_minutes = input.penalty_minutes ?? null;
      existing.pulled_at = input.pulled_at ?? new Date();
      return this.gymWriter.saveGymStanding(existing);
    }

    const standing = this.gymWriter.createGymStanding({
      teacher_id: teacherId,
      topic_id: gym.id,
      student_id: input.student_id,
      problem_id: input.problem_id,
      solved: input.solved,
      penalty_minutes: input.penalty_minutes ?? null,
      pulled_at: input.pulled_at ?? new Date(),
    });

    return this.gymWriter.saveGymStanding(standing);
  }
}
