import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type {
  ClassScheduleSummary,
} from '../../application/dto/ClassDto.js';
import { getClassId, getTeacherId } from './request-context.js';
import { ClassServiceError } from '../../../../shared/errors/class.error.js';

type ScheduleParams = {
  classId?: number;
};

type ScheduleDependencies = {
  classSchedules: {
    listClassSchedules(teacherId: number, classId: number): Promise<ClassScheduleSummary[]>;
  };
};

type ScheduleAction = 'listClassSchedules';

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
      if (error instanceof ClassServiceError) {
        throw error;
      }

      throw error;
    }
  }

  private async listClassSchedules(
    request: HttpRequest<unknown, ScheduleParams>,
  ): Promise<HttpResponse> {
    const schedules = await this.dependencies.classSchedules.listClassSchedules(
      getTeacherId(request),
      getClassId(request),
    );

    return {
      statusCode: 200,
      body: { schedules },
    };
  }
}
