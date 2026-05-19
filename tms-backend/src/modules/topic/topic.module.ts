import { AppDataSource } from '../../infrastructure/database/data-source.js';
import type { AppModule } from '../module.types.js';
import { AddTopicProblemUseCase } from './application/commands/AddTopicProblemUseCase.js';
import { CloseTopicUseCase } from './application/commands/CloseTopicUseCase.js';
import { CreateTopicUseCase } from './application/commands/CreateTopicUseCase.js';
import { UpsertTopicStandingUseCase } from './application/commands/UpsertTopicStandingUseCase.js';
import { GetTopicStandingMatrixUseCase } from './application/queries/GetTopicStandingMatrixUseCase.js';
import { ListTopicsUseCase } from './application/queries/ListTopicsUseCase.js';
import { Topic } from './infrastructure/persistence/typeorm/entities/topic.entity.js';
import { TopicBotConfig } from './infrastructure/persistence/typeorm/entities/topic-bot-config.entity.js';
import { TopicProblem } from './infrastructure/persistence/typeorm/entities/topic-problem.entity.js';
import { TopicStanding } from './infrastructure/persistence/typeorm/entities/topic-standing.entity.js';
import { TypeOrmTopicReader } from './infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmTopicWriter } from './infrastructure/persistence/typeorm/Writer.js';
import { TopicController } from './presentation/controllers/TopicController.js';
import { TopicStandingReportController } from './presentation/controllers/TopicStandingReportController.js';
import { createTopicStandingReportRouter } from './presentation/routes/topic-standing-report.routes.js';
import { createTopicRouter } from './presentation/routes/topic.routes.js';
const createTopicReader = () => new TypeOrmTopicReader(AppDataSource.manager);
const topicControllerDependencies = {
  listTopics: (teacherId: number, filters: Parameters<ListTopicsUseCase['execute']>[1]) =>
    new ListTopicsUseCase(createTopicReader()).execute(teacherId, filters),
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
    getTopicStandingMatrix: (teacherId, topicId) =>
      new GetTopicStandingMatrixUseCase(createTopicReader()).execute(teacherId, topicId),
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
