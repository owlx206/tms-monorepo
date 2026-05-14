import { DomainError } from '../../../../../shared/domain/DomainError.js';

import { TypeOrmStudentReportSourceReader } from './TypeOrmStudentReportSourceReader.js';

export class TypeOrmStudentReportReader {
  constructor(
    private readonly source = new TypeOrmStudentReportSourceReader(),
  ) {}

  countActiveStudents(teacherId: number): Promise<number> {
    return this.source.countActiveStudents(teacherId);
  }

  countActiveClasses(teacherId: number): Promise<number> {
    return this.source.countActiveClasses(teacherId);
  }

  async getStudentLearningProfileSource(teacherId: number, studentId: number) {
    const student = await this.source.findOwnedStudent(teacherId, studentId);
    if (!student) {
      throw new DomainError('student_not_found', 'student not found');
    }

    const standings = await this.source.findStudentTopicStandings(teacherId, studentId);
    const topicIds = Array.from(new Set(standings.map((item) => item.topic_id)));
    const problemIds = Array.from(new Set(standings.map((item) => item.problem_id)));
    const topics = await this.source.findTopicsByIds(teacherId, topicIds);
    const problems = await this.source.findTopicProblemsByIds(teacherId, problemIds);
    const classIds = Array.from(new Set(topics.map((topic) => topic.class_id)));
    const classes = await this.source.findClassesByIds(teacherId, classIds);

    return {
      student,
      standings,
      topics,
      problems,
      classes,
    };
  }
}
