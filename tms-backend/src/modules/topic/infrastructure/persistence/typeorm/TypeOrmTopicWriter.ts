import { type EntityManager } from 'typeorm';

import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { Class } from '../../../../../entities/class.entity.js';
import { Student } from '../../../../../entities/student.entity.js';
import { Teacher } from '../../../../../entities/teacher.entity.js';
import { Topic } from '../../../../../entities/topic.entity.js';
import { TopicProblem } from '../../../../../entities/topic-problem.entity.js';
import { TopicStanding } from '../../../../../entities/topic-standing.entity.js';
import {
  resolveCodeforcesCredentials,
} from '../../../../../infrastructure/external/codeforces/codeforces-api.service.js';

export class TypeOrmTopicWriter {
  constructor(private readonly manager: EntityManager = AppDataSource.manager) {}

  findClassById(classId: number) {
    return this.manager.getRepository(Class).findOneBy({ id: classId });
  }

  findTeacherById(teacherId: number) {
    return this.manager.getRepository(Teacher).findOneBy({ id: teacherId });
  }

  resolveTeacherCodeforcesCredentials(teacher: Teacher) {
    const resolved = resolveCodeforcesCredentials(
      teacher.codeforces_api_key,
      teacher.codeforces_api_secret,
    );

    return resolved
      ? {
        apiKey: resolved.apiKey,
        apiSecret: resolved.apiSecret,
      }
      : null;
  }

  findOwnedTopic(teacherId: number, topicId: number) {
    return this.manager.getRepository(Topic).findOneBy({
      id: topicId,
      teacher_id: teacherId,
    });
  }

  findTopicByGym(teacherId: number, classId: number, gymId: string) {
    return this.manager.getRepository(Topic).findOneBy({
      teacher_id: teacherId,
      class_id: classId,
      gym_id: gymId,
    });
  }

  createTopic(values: Partial<Topic>) {
    return this.manager.getRepository(Topic).create(values);
  }

  saveTopic(topic: Topic) {
    return this.manager.getRepository(Topic).save(topic);
  }

  findTopicProblemByIndex(topicId: number, problemIndex: string) {
    return this.manager.getRepository(TopicProblem).findOneBy({
      topic_id: topicId,
      problem_index: problemIndex,
    });
  }

  findOwnedTopicProblem(teacherId: number, topicId: number, problemId: number) {
    return this.manager.getRepository(TopicProblem).findOneBy({
      id: problemId,
      teacher_id: teacherId,
      topic_id: topicId,
    });
  }

  createTopicProblem(values: Partial<TopicProblem>) {
    return this.manager.getRepository(TopicProblem).create(values);
  }

  saveTopicProblem(topicProblem: TopicProblem) {
    return this.manager.getRepository(TopicProblem).save(topicProblem);
  }

  findOwnedStudent(teacherId: number, studentId: number) {
    return this.manager.getRepository(Student).findOneBy({
      id: studentId,
      teacher_id: teacherId,
    });
  }

  findTopicStanding(teacherId: number, topicId: number, studentId: number, problemId: number) {
    return this.manager.getRepository(TopicStanding).findOneBy({
      teacher_id: teacherId,
      topic_id: topicId,
      student_id: studentId,
      problem_id: problemId,
    });
  }

  createTopicStanding(values: Partial<TopicStanding>) {
    return this.manager.getRepository(TopicStanding).create(values);
  }

  saveTopicStanding(topicStanding: TopicStanding) {
    return this.manager.getRepository(TopicStanding).save(topicStanding);
  }
}
