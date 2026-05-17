import { AppDataSource } from '../../infrastructure/database/data-source.js';
import type { AppModule } from '../module.types.js';
import { AddTopicProblemUseCase } from './application/commands/AddTopicProblemUseCase.js';
import { CloseTopicUseCase } from './application/commands/CloseTopicUseCase.js';
import { CreateTopicUseCase } from './application/commands/CreateTopicUseCase.js';
import { UpsertTopicStandingUseCase } from './application/commands/UpsertTopicStandingUseCase.js';
import { GetTopicStandingMatrixUseCase } from './application/queries/GetTopicStandingMatrixUseCase.js';
import { ListTopicsUseCase } from './application/queries/ListTopicsUseCase.js';
import { Topic } from '../../entities/topic.entity.js';
import { TopicBotConfig } from '../../entities/topic-bot-config.entity.js';
import { TopicProblem } from '../../entities/topic-problem.entity.js';
import { TopicStanding } from '../../entities/topic-standing.entity.js';
import { TypeOrmTopicReader } from './infrastructure/persistence/typeorm/TypeOrmTopicReader.js';
import { TypeOrmTopicWriter } from './infrastructure/persistence/typeorm/TypeOrmTopicWriter.js';
import { TopicController } from './presentation/controllers/TopicController.js';
import { TopicStandingReportController } from './presentation/controllers/TopicStandingReportController.js';
import { createTopicStandingReportRouter } from './presentation/routes/topic-standing-report.routes.js';
import { createTopicRouter } from './presentation/routes/topic.routes.js';
const topicReader = new TypeOrmTopicReader();
const listTopicsUseCase = new ListTopicsUseCase(topicReader);
const getTopicStandingMatrixUseCase = new GetTopicStandingMatrixUseCase(topicReader);
const topicControllerDependencies = {
  listTopics: (teacherId: number, filters: Parameters<ListTopicsUseCase['execute']>[1]) =>
    listTopicsUseCase.execute(teacherId, filters),
  createTopic: (teacherId: number, input: Parameters<CreateTopicUseCase['execute']>[1]) =>
    AppDataSource.transaction((manager) =>
      new CreateTopicUseCase(new TypeOrmTopicWriter(manager)).execute(teacherId, input)),
  closeTopic: (teacherId: number, topicId: number) =>
    AppDataSource.transaction((manager) =>
      new CloseTopicUseCase(new TypeOrmTopicWriter(manager)).execute(teacherId, topicId)),
  addTopicProblem: (
    teacherId: number,
    topicId: number,
    input: Parameters<AddTopicProblemUseCase['execute']>[2],
  ) => AppDataSource.transaction((manager) =>
    new AddTopicProblemUseCase(new TypeOrmTopicWriter(manager)).execute(teacherId, topicId, input)),
  upsertTopicStanding: (
    teacherId: number,
    topicId: number,
    input: Parameters<UpsertTopicStandingUseCase['execute']>[2],
  ) => AppDataSource.transaction((manager) =>
    new UpsertTopicStandingUseCase(new TypeOrmTopicWriter(manager)).execute(
      teacherId,
      topicId,
      input,
    )),
};

const topicRouter = createTopicRouter({
  listTopics: new TopicController('listTopics', topicControllerDependencies),
  createTopic: new TopicController('createTopic', topicControllerDependencies),
  closeTopic: new TopicController('closeTopic', topicControllerDependencies),
  addTopicProblem: new TopicController('addTopicProblem', topicControllerDependencies),
  upsertTopicStanding: new TopicController('upsertTopicStanding', topicControllerDependencies),
});
const topicStandingReportRouter = createTopicStandingReportRouter(
  new TopicStandingReportController({
    getTopicStandingMatrix: (teacherId, topicId) => getTopicStandingMatrixUseCase.execute(teacherId, topicId),
  }),
);

export const topicModule: AppModule = {
  name: 'topic',
  entities: [Topic, TopicBotConfig, TopicProblem, TopicStanding],
  routes: [
    { path: '/', router: topicRouter },
    { path: '/', router: topicStandingReportRouter },
  ],
};
