import { ServiceError } from '../../../../shared/errors/service.error.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type { IncomeReportFilters } from '../../application/dto/FinanceDto.js';
import { getTeacherId } from './request-context.js';

export class FinanceReportController implements Controller {
  constructor(
    private readonly incomeReportReader: {
      getIncomeReport(teacherId: number, filters: IncomeReportFilters): Promise<unknown>;
    },
  ) {}

  async handle(request: HttpRequest<unknown, unknown, IncomeReportFilters>): Promise<HttpResponse> {
    try {
      const report = await this.incomeReportReader.getIncomeReport(getTeacherId(request), request.query ?? {});

      return {
        statusCode: 200,
        body: report,
      };
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }

      throw error;
    }
  }
}
