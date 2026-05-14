import type { Class } from '../../../../../entities/class.entity.js';
import type { Student } from '../../../../../entities/student.entity.js';
import type { Teacher } from '../../../../../entities/teacher.entity.js';
import type { Topic } from '../../../../../entities/topic.entity.js';
import type { TopicProblem } from '../../../../../entities/topic-problem.entity.js';
import type { TopicStanding } from '../../../../../entities/topic-standing.entity.js';
import type { CodeforcesCredentials } from '../../../../../infrastructure/external/codeforces/codeforces-api.service.js';

export interface TopicWriteRepository {
  findClassById(classId: number): Promise<Class | null>;
  findTeacherById(teacherId: number): Promise<Teacher | null>;
  resolveTeacherCodeforcesCredentials(teacher: Teacher): CodeforcesCredentials | null;
  findOwnedTopic(teacherId: number, topicId: number): Promise<Topic | null>;
  findTopicByGym(teacherId: number, classId: number, gymId: string): Promise<Topic | null>;
  createTopic(values: Partial<Topic>): Topic;
  saveTopic(topic: Topic): Promise<Topic>;
  findTopicProblemByIndex(topicId: number, problemIndex: string): Promise<TopicProblem | null>;
  findOwnedTopicProblem(teacherId: number, topicId: number, problemId: number): Promise<TopicProblem | null>;
  createTopicProblem(values: Partial<TopicProblem>): TopicProblem;
  saveTopicProblem(topicProblem: TopicProblem): Promise<TopicProblem>;
  findOwnedStudent(teacherId: number, studentId: number): Promise<Student | null>;
  findTopicStanding(
    teacherId: number,
    topicId: number,
    studentId: number,
    problemId: number,
  ): Promise<TopicStanding | null>;
  createTopicStanding(values: Partial<TopicStanding>): TopicStanding;
  saveTopicStanding(topicStanding: TopicStanding): Promise<TopicStanding>;
}
