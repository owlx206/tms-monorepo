export type TopicStatusFilter = 'active' | 'closed';

export type TopicListQuery = {
  class_id?: number;
  status?: TopicStatusFilter;
};

export type CreateTopicInput = {
  class_id: number;
  gym_link: string;
  pull_interval_minutes?: number;
};

export type AddTopicProblemInput = {
  problem_index: string;
  problem_name?: string | null;
};

export type UpsertTopicStandingInput = {
  student_id: number;
  problem_id: number;
  solved: boolean;
  penalty_minutes?: number | null;
  pulled_at?: Date;
};

export type TopicSummarySource = {
  closed_at: Date | null;
};

export type ListTopicsReader<TTopic extends TopicSummarySource = TopicSummarySource> = {
  listTopicsForTeacher(teacherId: number, filters: { class_id?: number }): Promise<TTopic[]>;
};

export type TopicStandingMatrixTopic = {
  id: number;
  class_id: number;
};

export type TopicStandingMatrixProblem = {
  id: number;
  problem_index: string;
  problem_name: string | null;
};

export type TopicStandingMatrixEnrollment = {
  student_id: number;
};

export type TopicStandingMatrixStudent = {
  id: number;
  full_name: string;
};

export type TopicStandingMatrixStanding = {
  student_id: number;
  problem_id: number;
  solved: boolean;
  penalty_minutes: number | null;
  pulled_at: Date | null;
};

export type TopicStandingMatrixReader<
  TTopic extends TopicStandingMatrixTopic = TopicStandingMatrixTopic,
  TProblem extends TopicStandingMatrixProblem = TopicStandingMatrixProblem,
  TEnrollment extends TopicStandingMatrixEnrollment = TopicStandingMatrixEnrollment,
  TStudent extends TopicStandingMatrixStudent = TopicStandingMatrixStudent,
  TStanding extends TopicStandingMatrixStanding = TopicStandingMatrixStanding,
> = {
  findOwnedTopic(teacherId: number, topicId: number): Promise<TTopic | null>;
  listTopicProblems(teacherId: number, topicId: number): Promise<TProblem[]>;
  listActiveEnrollmentsForClass(teacherId: number, classId: number): Promise<TEnrollment[]>;
  findStudentsByIds(teacherId: number, studentIds: number[]): Promise<TStudent[]>;
  listTopicStandings(teacherId: number, topicId: number): Promise<TStanding[]>;
};
