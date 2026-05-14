import { ClassServiceError } from '../../../../shared/errors/class.error.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type {
  ClassListFilters,
  ClassDetails,
  ClassSummary,
  CreateClassInput,
  UpdateClassInput,
} from '../../application/dto/ClassDto.js';
import { ClassroomUseCase } from '../../application/queries/ClassroomUseCase.js';
import { getClassId, getTeacherId } from './request-context.js';

type ClassroomControllerDependencies = {
  classroom: ClassroomUseCase;
  createClass: {
    createClass(input: {
      teacherId: number;
      name: string;
      feePerSession: string;
      schedules: CreateClassInput['schedules'];
    }): Promise<ClassSummary>;
  };
  updateClass: {
    updateClass(input: {
      teacherId: number;
      classId: number;
      name?: string;
      feePerSession?: string;
      schedules?: UpdateClassInput['schedules'];
    }): Promise<ClassSummary>;
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

type ClassroomHttpRequest = HttpRequest<CreateClassInput | UpdateClassInput, { classId?: number }, ClassListFilters>;

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
      if (error instanceof ClassServiceError) {
        throw error;
      }

      throw error;
    }
  }

  private async listClasses(request: ClassroomHttpRequest): Promise<HttpResponse> {
    const classes = await this.dependencies.classroom.list(
      getTeacherId(request),
      request.query ?? {},
    );

    return {
      statusCode: 200,
      body: { classes },
    };
  }

  private async getClassById(request: ClassroomHttpRequest): Promise<HttpResponse> {
    const classEntity = await this.dependencies.classroom.getById(
      getTeacherId(request),
      getClassId(request),
    );

    return {
      statusCode: 200,
      body: { class: classEntity },
    };
  }

  private async getClassDetails(request: ClassroomHttpRequest): Promise<HttpResponse> {
    const details: ClassDetails = await this.dependencies.classroom.getDetails(
      getTeacherId(request),
      getClassId(request),
    );

    return {
      statusCode: 200,
      body: { details },
    };
  }

  private async createClass(request: ClassroomHttpRequest): Promise<HttpResponse> {
    const input = request.body as CreateClassInput;
    const classEntity = await this.dependencies.createClass.createClass({
      teacherId: getTeacherId(request),
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
      teacherId: getTeacherId(request),
      classId: getClassId(request),
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
      teacherId: getTeacherId(request),
      classId: getClassId(request),
      archivedAt: new Date(),
    });

    return {
      statusCode: 200,
      body: { class: classEntity },
    };
  }
}
