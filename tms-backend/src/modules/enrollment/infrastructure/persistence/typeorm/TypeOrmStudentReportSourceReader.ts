import { In } from 'typeorm';

import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { Class } from '../../../../../entities/class.entity.js';
import { ClassStatus, StudentStatus } from '../../../../../entities/enums.js';
import { Student } from '../../../../../entities/student.entity.js';
import { TopicProblem } from '../../../../../entities/topic-problem.entity.js';
import { TopicStanding } from '../../../../../entities/topic-standing.entity.js';
import { Topic } from '../../../../../entities/topic.entity.js';

export class TypeOrmStudentReportSourceReader {
  countActiveStudents(teacherId: number): Promise<number> {
    return AppDataSource.getRepository(Student).countBy({
      teacher_id: teacherId,
      status: StudentStatus.Active,
    });
  }

  countActiveClasses(teacherId: number): Promise<number> {
    return AppDataSource.getRepository(Class).countBy({
      teacher_id: teacherId,
      status: ClassStatus.Active,
    });
  }

  findOwnedStudent(teacherId: number, studentId: number): Promise<Student | null> {
    return AppDataSource.getRepository(Student).findOneBy({
      id: studentId,
      teacher_id: teacherId,
    });
  }

  findClassesByIds(teacherId: number, classIds: number[]): Promise<Class[]> {
    return classIds.length > 0
      ? AppDataSource.getRepository(Class).findBy({ teacher_id: teacherId, id: In(classIds) })
      : Promise.resolve([]);
  }

  findTopicsByIds(teacherId: number, topicIds: number[]): Promise<Topic[]> {
    return topicIds.length > 0
      ? AppDataSource.getRepository(Topic).findBy({ teacher_id: teacherId, id: In(topicIds) })
      : Promise.resolve([]);
  }

  findTopicProblemsByIds(teacherId: number, problemIds: number[]): Promise<TopicProblem[]> {
    return problemIds.length > 0
      ? AppDataSource.getRepository(TopicProblem).findBy({ teacher_id: teacherId, id: In(problemIds) })
      : Promise.resolve([]);
  }

  findStudentTopicStandings(teacherId: number, studentId: number): Promise<TopicStanding[]> {
    return AppDataSource.getRepository(TopicStanding).find({
      where: {
        teacher_id: teacherId,
        student_id: studentId,
      },
      order: {
        pulled_at: 'DESC',
      },
    });
  }
}
