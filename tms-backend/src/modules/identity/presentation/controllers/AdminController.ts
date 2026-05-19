import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type { ParsedRequestContext } from '../../../../infrastructure/http/request-context.js';
import type {
  SysadminDiscordBotCredentialInput,
  SysadminDiscordBotCredentialView,
  AdminTeacher,
  UpdateTeacherByAdminInput,
} from '../../contracts/types.js';

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

  async handle(
    request: HttpRequest<unknown, { teacherId: number }, unknown, unknown, ParsedRequestContext<unknown, { teacherId: number }> & { teacherId: number }>,
  ): Promise<HttpResponse> {
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
      if (error instanceof HttpError) {
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

  private async updateTeacher(
    request: HttpRequest<unknown, { teacherId: number }, unknown, unknown, ParsedRequestContext<unknown, { teacherId: number }> & { teacherId: number }>,
  ): Promise<HttpResponse> {
    const teacher = await this.dependencies.updateTeacher.execute(
      request.context.teacherId,
      request.context.params.teacherId,
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
