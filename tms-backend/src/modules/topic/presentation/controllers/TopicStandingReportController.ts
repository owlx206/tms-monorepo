import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type { ParsedRequestContext } from '../../../../infrastructure/http/request-context.js';

type TopicStandingReportDependencies = {
  getTopicStandingMatrix(teacherId: number, topicId: number): Promise<unknown>;
};

export class TopicStandingReportController implements Controller {
  constructor(private readonly dependencies: TopicStandingReportDependencies) {}

  async handle(
    request: HttpRequest<unknown, { topicId: number }, unknown, unknown, ParsedRequestContext<unknown, { topicId: number }> & { teacherId: number }>,
  ): Promise<HttpResponse> {
    const matrix = await this.dependencies.getTopicStandingMatrix(
      request.context.teacherId,
      request.context.params.topicId,
    );

    return {
      statusCode: 200,
      body: matrix,
    };
  }
}
