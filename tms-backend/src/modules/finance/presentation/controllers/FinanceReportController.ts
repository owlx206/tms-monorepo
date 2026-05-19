import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type { ParsedRequestContext } from '../../../../infrastructure/http/request-context.js';
import type { IncomeReportFilters } from '../../contracts/types.js';

export class FinanceReportController implements Controller {
  constructor(
    private readonly incomeReportReader: {
      getIncomeReport(teacherId: number, filters: IncomeReportFilters): Promise<unknown>;
    },
  ) {}

  async handle(
    request: HttpRequest<unknown, unknown, IncomeReportFilters, unknown, ParsedRequestContext<unknown, unknown, IncomeReportFilters> & { teacherId: number }>,
  ): Promise<HttpResponse> {
    try {
      const report = await this.incomeReportReader.getIncomeReport(request.context.teacherId, request.query ?? {});

      return {
        statusCode: 200,
        body: report,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw error;
    }
  }
}
