import type { Enrollment } from '../../../enrollment/infrastructure/persistence/typeorm/entities/enrollment.entity.js';
import type { Student } from '../../../enrollment/infrastructure/persistence/typeorm/entities/student.entity.js';
import type { Topic } from '../../infrastructure/persistence/typeorm/entities/topic.entity.js';
import type { TopicProblem } from '../../infrastructure/persistence/typeorm/entities/topic-problem.entity.js';
import type { TopicStanding } from '../../infrastructure/persistence/typeorm/entities/topic-standing.entity.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { TopicStandingMatrixReader } from '../../contracts/types.js';

export class GetTopicStandingMatrixUseCase {
  constructor(
    private readonly topics: TopicStandingMatrixReader<
      Topic,
      TopicProblem,
      Enrollment,
      Student,
      TopicStanding
    >,
  ) {}

  async execute(teacherId: number, topicId: number) {
    const topic = await this.topics.findOwnedTopic(teacherId, topicId);
    if (!topic) {
      throw new HttpError('topic not found', 404);
    }

    const problems = await this.topics.listTopicProblems(teacherId, topicId);
    const activeEnrollments = await this.topics.listActiveEnrollmentsForClass(
      teacherId,
      topic.class_id,
    );
    const studentIds = Array.from(new Set(activeEnrollments.map((item) => item.student_id)));
    const students = await this.topics.findStudentsByIds(teacherId, studentIds);
    const standings = await this.topics.listTopicStandings(teacherId, topicId);

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
      topic,
      problems,
      rows,
    };
  }
}
