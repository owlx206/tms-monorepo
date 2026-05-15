import { ServiceError } from '../../../../shared/errors/service.error.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type {
  SysadminDiscordBotCredentialInput,
  SysadminDiscordBotCredentialView,
  AdminTeacher,
  UpdateTeacherByAdminInput,
} from '../../application/dto/AdminDto.js';
import { getTeacher } from './request-context.js';

type AdminControllerAction =
  | 'listTeachers'
  | 'updateTeacher'
  | 'getDiscordBotCredential'
  | 'upsertDiscordBotCredential';

type AdminControllerDependencies = {
  listTeachers: { execute(): Promise<AdminTeacher[]> };
  getDiscordBotCredential: { execute(): Promise<SysadminDiscordBotCredentialView | null> };
  updateTeacher: {
    execute(actorTeacherId: number, teacherId: number, input: UpdateTeacherByAdminInput): Promise<unknown>;
  };
  upsertDiscordBotCredential: {
    execute(input: SysadminDiscordBotCredentialInput): Promise<unknown>;
  };
};

export class AdminController implements Controller {
  constructor(
    private readonly action: AdminControllerAction,
    private readonly dependencies: AdminControllerDependencies,
  ) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    try {
      switch (this.action) {
        case 'listTeachers':
          return this.listTeachers();
        case 'updateTeacher':
          return this.updateTeacher(request);
        case 'getDiscordBotCredential':
          return this.getDiscordBotCredential();
        case 'upsertDiscordBotCredential':
          return this.upsertDiscordBotCredential(request);
      }
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }

      throw error;
    }
  }

  private async listTeachers(): Promise<HttpResponse> {
    const teachers = await this.dependencies.listTeachers.execute();

    return {
      statusCode: 200,
      body: { teachers },
    };
  }

  private async updateTeacher(request: HttpRequest): Promise<HttpResponse> {
    const actorTeacherId = getTeacher(request).id;
    const teacherId = (request.params as { teacherId?: number }).teacherId;

    if (typeof teacherId !== 'number') {
      throw new ServiceError('teacherId is required', 400);
    }

    const teacher = await this.dependencies.updateTeacher.execute(
      actorTeacherId,
      teacherId,
      request.body as UpdateTeacherByAdminInput,
    );

    return {
      statusCode: 200,
      body: { teacher },
    };
  }

  private async getDiscordBotCredential(): Promise<HttpResponse> {
    const credential = await this.dependencies.getDiscordBotCredential.execute();

    return {
      statusCode: 200,
      body: { credential },
    };
  }

  private async upsertDiscordBotCredential(request: HttpRequest): Promise<HttpResponse> {
    const credential = await this.dependencies.upsertDiscordBotCredential.execute(
      request.body as SysadminDiscordBotCredentialInput,
    );

    return {
      statusCode: 200,
      body: { credential },
    };
  }
}
