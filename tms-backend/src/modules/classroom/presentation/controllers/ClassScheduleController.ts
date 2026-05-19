import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type { ParsedRequestContext } from '../../../../infrastructure/http/request-context.js';
import type {
  ClassScheduleSummary,
} from '../../contracts/types.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';

type ScheduleParams = {
  classId: number;
};

type ScheduleDependencies = {
  classSchedules: {
    listClassSchedules(teacherId: number, classId: number): Promise<ClassScheduleSummary[]>;
  };
};

type ScheduleAction = 'listClassSchedules';
type ScheduleContext = ParsedRequestContext<unknown, ScheduleParams> & { teacherId: number };

export class ClassScheduleController implements Controller {
  constructor(
    private readonly action: ScheduleAction,
    private readonly dependencies: ScheduleDependencies,
  ) {}

  async handle(
    request: HttpRequest<unknown, ScheduleParams>,
  ): Promise<HttpResponse> {
    try {
      switch (this.action) {
        case 'listClassSchedules':
          return this.listClassSchedules(request);
      }
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw error;
    }
  }

  private async listClassSchedules(
    request: HttpRequest<unknown, ScheduleParams>,
  ): Promise<HttpResponse> {
    const schedules = await this.dependencies.classSchedules.listClassSchedules(
      (request.context as ScheduleContext).teacherId,
      (request.context as ScheduleContext).params.classId,
    );

    return {
      statusCode: 200,
      body: { schedules },
    };
  }
}
