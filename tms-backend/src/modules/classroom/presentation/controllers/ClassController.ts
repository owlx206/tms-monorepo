import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type { ParsedRequestContext } from '../../../../infrastructure/http/request-context.js';
import type {
  ClassListFilters,
  ClassDetails,
  ClassSummary,
  ClassSummaryWithSchedules,
  CreateClassInput,
  UpdateClassInput,
} from '../../contracts/types.js';

type ClassroomControllerDependencies = {
  classes: {
    listClasses(teacherId: number, filters: ClassListFilters): Promise<ClassSummary[]>;
    getClassById(teacherId: number, classId: number): Promise<ClassSummary | null>;
    getClassDetails(teacherId: number, classId: number): Promise<ClassDetails | null>;
  };
  createClass: {
    createClass(input: {
      teacherId: number;
      name: string;
      feePerSession: string;
      schedules: CreateClassInput['schedules'];
    }): Promise<ClassSummaryWithSchedules>;
  };
  updateClass: {
    updateClass(input: {
      teacherId: number;
      classId: number;
      name?: string;
      feePerSession?: string;
      schedules?: UpdateClassInput['schedules'];
    }): Promise<ClassSummaryWithSchedules>;
  };
  archiveClass: {
    archiveClass(input: {
      teacherId: number;
      classId: number;
      archivedAt: Date;
    }): Promise<ClassSummary>;
  };
};

type ClassroomControllerAction =
  | 'listClasses'
  | 'getClassById'
  | 'getClassDetails'
  | 'createClass'
  | 'updateClass'
  | 'archiveClass';

type ClassroomContext = ParsedRequestContext<
  CreateClassInput | UpdateClassInput,
  { classId: number },
  ClassListFilters
> & { teacherId: number };

type ClassroomHttpRequest = HttpRequest<
  CreateClassInput | UpdateClassInput,
  { classId: number },
  ClassListFilters,
  unknown,
  ClassroomContext
>;

export class ClassController implements Controller {
  constructor(
    private readonly action: ClassroomControllerAction,
    private readonly dependencies: ClassroomControllerDependencies,
  ) {}

  async handle(request: ClassroomHttpRequest): Promise<HttpResponse> {
    try {
      switch (this.action) {
        case 'listClasses':
          return this.listClasses(request);
        case 'getClassById':
          return this.getClassById(request);
        case 'getClassDetails':
          return this.getClassDetails(request);
        case 'createClass':
          return this.createClass(request);
        case 'updateClass':
          return this.updateClass(request);
        case 'archiveClass':
          return this.archiveClass(request);
      }
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw error;
    }
  }

  private async listClasses(request: ClassroomHttpRequest): Promise<HttpResponse> {
    const classes = await this.dependencies.classes.listClasses(
      request.context.teacherId,
      request.query ?? {},
    );

    return {
      statusCode: 200,
      body: { classes },
    };
  }

  private async getClassById(request: ClassroomHttpRequest): Promise<HttpResponse> {
    const classEntity = await this.dependencies.classes.getClassById(
      request.context.teacherId,
      request.context.params.classId,
    );

    if (!classEntity) {
      throw new HttpError('class not found', 404);
    }

    return {
      statusCode: 200,
      body: { class: classEntity },
    };
  }

  private async getClassDetails(request: ClassroomHttpRequest): Promise<HttpResponse> {
    const details = await this.dependencies.classes.getClassDetails(
      request.context.teacherId,
      request.context.params.classId,
    );

    if (!details) {
      throw new HttpError('class not found', 404);
    }

    return {
      statusCode: 200,
      body: { details },
    };
  }

  private async createClass(request: ClassroomHttpRequest): Promise<HttpResponse> {
    const input = request.body as CreateClassInput;
    const classEntity = await this.dependencies.createClass.createClass({
      teacherId: request.context.teacherId,
      name: input.name,
      feePerSession: input.fee_per_session,
      schedules: input.schedules,
    });

    return {
      statusCode: 201,
      body: { class: classEntity },
    };
  }

  private async updateClass(request: ClassroomHttpRequest): Promise<HttpResponse> {
    const input = request.body as UpdateClassInput;
    const classEntity = await this.dependencies.updateClass.updateClass({
      teacherId: request.context.teacherId,
      classId: request.context.params.classId,
      name: input.name,
      feePerSession: input.fee_per_session,
      schedules: input.schedules,
    });

    return {
      statusCode: 200,
      body: { class: classEntity },
    };
  }

  private async archiveClass(request: ClassroomHttpRequest): Promise<HttpResponse> {
    const classEntity = await this.dependencies.archiveClass.archiveClass({
      teacherId: request.context.teacherId,
      classId: request.context.params.classId,
      archivedAt: new Date(),
    });

    return {
      statusCode: 200,
      body: { class: classEntity },
    };
  }
}
