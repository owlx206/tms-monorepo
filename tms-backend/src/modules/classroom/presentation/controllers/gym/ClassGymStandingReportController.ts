import type { Controller } from '../../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../../shared/presentation/HttpResponse.js';
import type { ParsedRequestContext } from '../../../../../infrastructure/http/request-context.js';

type ClassGymStandingReportDependencies = {
  getGymStandingMatrix(teacherId: number, classId: number, gymId: number): Promise<unknown>;
};

export class ClassGymStandingReportController implements Controller {
  constructor(private readonly dependencies: ClassGymStandingReportDependencies) {}

  async handle(
    request: HttpRequest<unknown, { classId: number; gymId: number }, unknown, unknown, ParsedRequestContext<unknown, { classId: number; gymId: number }> & { teacherId: number }>,
  ): Promise<HttpResponse> {
    const matrix = await this.dependencies.getGymStandingMatrix(
      request.context.teacherId,
      request.context.params.classId,
      request.context.params.gymId,
    );

    return {
      statusCode: 200,
      body: matrix,
    };
  }
}
