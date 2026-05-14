import type { TypeOrmFinanceReportReader } from '../../infrastructure/persistence/typeorm/TypeOrmFinanceReportReader.js';

type StudentLearningProfileReader = {
  getStudentLearningProfileSource(teacherId: number, studentId: number): Promise<{
    student: unknown;
    standings: Array<{
      topic_id: number;
      problem_id: number;
      solved: boolean;
      penalty_minutes: number | null;
      pulled_at: Date;
    }>;
    topics: Array<{
      id: number;
      title: string;
      class_id: number;
      gym_link: string | null;
      gym_id: string | null;
      closed_at: Date | null;
    }>;
    problems: Array<{
      id: number;
      problem_index: string;
      problem_name: string | null;
    }>;
    classes: Array<{
      id: number;
      name: string;
    }>;
  }>;
};

export class GetStudentLearningProfileUseCase {
  constructor(
    private readonly reports: StudentLearningProfileReader,
    private readonly finance: TypeOrmFinanceReportReader,
  ) {}

  async execute(teacherId: number, studentId: number) {
    const source = await this.reports.getStudentLearningProfileSource(teacherId, studentId);

    if (source.standings.length === 0) {
      return {
        student: source.student,
        topics: [],
        transactions: [],
      };
    }

    const topicById = new Map(source.topics.map((topic) => [topic.id, topic]));
    const problemById = new Map(source.problems.map((problem) => [problem.id, problem]));
    const classNameById = new Map(source.classes.map((item) => [item.id, item.name]));
    const groupedByTopic = new Map<number, typeof source.standings>();

    source.standings.forEach((standing) => {
      const list = groupedByTopic.get(standing.topic_id);
      if (list) {
        list.push(standing);
        return;
      }

      groupedByTopic.set(standing.topic_id, [standing]);
    });

    const topicRows = Array.from(groupedByTopic.entries())
      .map(([topicId, rows]) => {
        const topic = topicById.get(topicId);
        if (!topic) {
          return null;
        }

        const uniqueProblemIds = new Set<number>();
        let solvedCount = 0;
        let latestPulledAt: Date | null = null;

        const problemRows = rows.map((row) => {
          uniqueProblemIds.add(row.problem_id);
          if (row.solved) {
            solvedCount += 1;
          }

          if (!latestPulledAt || row.pulled_at.getTime() > latestPulledAt.getTime()) {
            latestPulledAt = row.pulled_at;
          }

          const problem = problemById.get(row.problem_id);
          return {
            problem_id: row.problem_id,
            problem_index: problem?.problem_index ?? '',
            problem_name: problem?.problem_name ?? null,
            solved: row.solved,
            penalty_minutes: row.penalty_minutes,
            pulled_at: row.pulled_at,
          };
        });

        problemRows.sort((a, b) => a.problem_index.localeCompare(b.problem_index, 'vi'));

        return {
          topic_id: topic.id,
          topic_title: topic.title,
          class_id: topic.class_id,
          class_name: classNameById.get(topic.class_id) ?? `Lop #${topic.class_id}`,
          gym_link: topic.gym_link,
          gym_id: topic.gym_id,
          closed_at: topic.closed_at,
          solved_count: solvedCount,
          total_problems: uniqueProblemIds.size,
          last_pulled_at: latestPulledAt,
          problems: problemRows,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => a.topic_title.localeCompare(b.topic_title, 'vi'));

    const { items: transactions } = await this.finance.listTransactions({
      teacherId,
      studentId,
    });

    return {
      student: source.student,
      topics: topicRows,
      transactions,
    };
  }
}
