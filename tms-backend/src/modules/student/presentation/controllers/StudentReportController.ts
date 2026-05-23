import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type { ParsedRequestContext } from '../../../../infrastructure/http/request-context.js';
import { GetDashboardSummaryUseCase } from '../../application/queries/GetDashboardSummaryUseCase.js';
import { GetStudentLearningProfileUseCase } from '../../application/queries/GetStudentLearningProfileUseCase.js';

type StudentReportControllerAction = 'getDashboardSummary' | 'getStudentLearningProfile';

type StudentReportHttpRequest = HttpRequest<
  unknown,
  { studentId: number },
  unknown,
  unknown,
  ParsedRequestContext<unknown, { studentId: number }> & { teacherId: number }
>;

export class StudentReportController implements Controller {
  constructor(
    private readonly action: StudentReportControllerAction,
    private readonly dependencies: {
      getDashboardSummary: GetDashboardSummaryUseCase;
      getStudentLearningProfile: GetStudentLearningProfileUseCase;
    },
  ) {}

  async handle(request: StudentReportHttpRequest): Promise<HttpResponse> {
    switch (this.action) {
      case 'getDashboardSummary': {
        const summary = await this.dependencies.getDashboardSummary.execute(request.context.teacherId);
        return {
          statusCode: 200,
          body: { summary },
        };
      }
      case 'getStudentLearningProfile': {
        const profile = await this.dependencies.getStudentLearningProfile.execute(
          request.context.teacherId,
          request.context.params.studentId,
        );
        return {
          statusCode: 200,
          body: profile,
        };
      }
    }
  }
}
