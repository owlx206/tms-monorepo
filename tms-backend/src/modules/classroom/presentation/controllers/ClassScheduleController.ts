import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type {
  ClassScheduleInput,
  ClassScheduleSummary,
} from '../../application/dto/ClassDto.js';
import { getClassId, getTeacherId } from './request-context.js';
import { ClassServiceError } from '../../../../shared/errors/class.error.js';

type ScheduleParams = {
  classId?: number;
  scheduleId?: number;
};

type ScheduleDependencies = {
  classSchedules: {
    listClassSchedules(teacherId: number, classId: number): Promise<ClassScheduleSummary[]>;
  };
  commandHandlers: {
    createClassSchedule(input: {
      teacherId: number;
      classId: number;
      schedule: ClassScheduleInput;
    }): Promise<{ schedule: ClassScheduleSummary; sessions_created: number }>;
    updateClassSchedule(input: {
      teacherId: number;
      classId: number;
      scheduleId: number;
      schedule: Partial<ClassScheduleInput>;
    }): Promise<{ schedule: ClassScheduleSummary; sessions_created: number }>;
    deleteClassSchedule(input: {
      teacherId: number;
      classId: number;
      scheduleId: number;
    }): Promise<void>;
  };
};

type ScheduleAction =
  | 'listClassSchedules'
  | 'createClassSchedule'
  | 'updateClassSchedule'
  | 'deleteClassSchedule';

export class ClassScheduleController implements Controller {
  constructor(
    private readonly action: ScheduleAction,
    private readonly dependencies: ScheduleDependencies,
  ) {}

  async handle(
    request: HttpRequest<ClassScheduleInput | Partial<ClassScheduleInput>, ScheduleParams>,
  ): Promise<HttpResponse> {
    try {
      switch (this.action) {
        case 'listClassSchedules':
          return this.listClassSchedules(request);
        case 'createClassSchedule':
          return this.createClassSchedule(request as HttpRequest<ClassScheduleInput, ScheduleParams>);
        case 'updateClassSchedule':
          return this.updateClassSchedule(request as HttpRequest<Partial<ClassScheduleInput>, ScheduleParams>);
        case 'deleteClassSchedule':
          return this.deleteClassSchedule(request);
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

  private async createClassSchedule(
    request: HttpRequest<ClassScheduleInput, ScheduleParams>,
  ): Promise<HttpResponse> {
    const result = await this.dependencies.commandHandlers.createClassSchedule({
      teacherId: getTeacherId(request),
      classId: getClassId(request),
      schedule: request.body,
    });

    return {
      statusCode: 201,
      body: result,
    };
  }

  private async updateClassSchedule(
    request: HttpRequest<Partial<ClassScheduleInput>, ScheduleParams>,
  ): Promise<HttpResponse> {
    const result = await this.dependencies.commandHandlers.updateClassSchedule({
      teacherId: getTeacherId(request),
      classId: getClassId(request),
      scheduleId: this.getScheduleId(request),
      schedule: request.body,
    });

    return {
      statusCode: 200,
      body: result,
    };
  }

  private async deleteClassSchedule(
    request: HttpRequest<unknown, ScheduleParams>,
  ): Promise<HttpResponse> {
    await this.dependencies.commandHandlers.deleteClassSchedule({
      teacherId: getTeacherId(request),
      classId: getClassId(request),
      scheduleId: this.getScheduleId(request),
    });

    return {
      statusCode: 204,
      body: undefined,
    };
  }

  private getScheduleId(request: HttpRequest<unknown, ScheduleParams>): number {
    const scheduleId = request.params?.scheduleId;

    if (!Number.isInteger(scheduleId) || (scheduleId as number) <= 0) {
      throw new ClassServiceError('scheduleId param is required', 400);
    }

    return scheduleId as number;
  }
}
