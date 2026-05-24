import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { GymStandingMatrixReader } from '../../contracts/types.js';

export class GetGymStanding {
  constructor(private readonly gyms: GymStandingMatrixReader) {}

  async execute(teacherId: number, classId: number, gymId: number) {
    const gym = await this.gyms.findOwnedClassGym(teacherId, classId, gymId);
    if (!gym) {
      throw new HttpError('gym not found', 404);
    }

    if (gym.class_id === null) {
      throw new HttpError('gym is not bound to a class', 409);
    }

    const problems = await this.gyms.listGymProblems(teacherId, gymId);
    const activeEnrollments = await this.gyms.listActiveEnrollmentsForClass(
      teacherId,
      gym.class_id,
    );
    const studentIds = Array.from(new Set(activeEnrollments.map((item) => item.student_id)));
    const students = await this.gyms.findStudentsByIds(teacherId, studentIds);
    const standings = await this.gyms.listGymStandings(teacherId, gymId);

    const standingMap = new Map<string, (typeof standings)[number]>();
    standings.forEach((standing) => {
      standingMap.set(`${standing.student_id}:${standing.problem_id}`, standing);
    });

    const rows = students
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'))
      .map((student) => {
        const problemRows = problems.map((problem) => {
          const standing = standingMap.get(`${student.id}:${problem.id}`);
          return {
            problem_id: problem.id,
            problem_index: problem.problem_index,
            problem_name: problem.problem_name,
            solved: standing?.solved ?? false,
            penalty_minutes: standing?.penalty_minutes ?? null,
            pulled_at: standing?.pulled_at ?? null,
          };
        });

        return {
          student_id: student.id,
          student_name: student.full_name,
          solved_count: problemRows.filter((item) => item.solved).length,
          problems: problemRows,
        };
      });

    return {
      gym,
      problems,
      rows,
    };
  }
}
