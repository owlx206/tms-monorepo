import { In, IsNull, type EntityManager } from 'typeorm';

import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { Enrollment } from '../../../../../entities/enrollment.entity.js';
import { Student } from '../../../../../entities/student.entity.js';
import { Topic } from '../../../../../entities/topic.entity.js';
import { TopicProblem } from '../../../../../entities/topic-problem.entity.js';
import { TopicStanding } from '../../../../../entities/topic-standing.entity.js';

export class TypeOrmTopicReader {
  constructor(private readonly manager: EntityManager = AppDataSource.manager) {}

  listTopicsForTeacher(teacherId: number, filters: { class_id?: number }) {
    return this.manager.getRepository(Topic).find({
      where: {
        teacher_id: teacherId,
        ...(filters.class_id !== undefined ? { class_id: filters.class_id } : {}),
      },
      order: {
        created_at: 'DESC',
      },
    });
  }

  findOwnedTopic(teacherId: number, topicId: number) {
    return this.manager.getRepository(Topic).findOneBy({
      id: topicId,
      teacher_id: teacherId,
    });
  }

  listTopicProblems(teacherId: number, topicId: number) {
    return this.manager.getRepository(TopicProblem).find({
      where: {
        teacher_id: teacherId,
        topic_id: topicId,
      },
      order: {
        problem_index: 'ASC',
      },
    });
  }

  listActiveEnrollmentsForClass(teacherId: number, classId: number) {
    return this.manager.getRepository(Enrollment).find({
      where: {
        teacher_id: teacherId,
        class_id: classId,
        unenrolled_at: IsNull(),
      },
    });
  }

  findStudentsByIds(teacherId: number, studentIds: number[]) {
    if (studentIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.manager.getRepository(Student).findBy({
      teacher_id: teacherId,
      id: In(studentIds),
    });
  }

  listTopicStandings(teacherId: number, topicId: number) {
    return this.manager.getRepository(TopicStanding).find({
      where: {
        teacher_id: teacherId,
        topic_id: topicId,
      },
    });
  }
}
