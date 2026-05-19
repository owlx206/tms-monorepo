import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type { ParsedRequestContext } from '../../../../infrastructure/http/request-context.js';
import type {
  CreateManualSessionInput,
  SessionListFilters,
  SessionSummary,
} from '../../contracts/types.js';

type SessionDependencies = {
  sessions: {
    listSessions(teacherId: number, filters: SessionListFilters): Promise<SessionSummary[]>;
  };
  commandHandlers: {
    createManualSession(input: {
      teacherId: number;
      classId: number;
      session: CreateManualSessionInput;
    }): Promise<unknown>;
    cancelSession(input: {
      teacherId: number;
      sessionId: number;
    }): Promise<unknown>;
  };
};

type SessionAction =
  | 'listSessions'
  | 'listClassSessions'
  | 'createManualSession'
  | 'cancelSession';

type SessionParams = {
  classId: number;
  sessionId: number;
};
type SessionContext = ParsedRequestContext<CreateManualSessionInput, SessionParams, SessionListFilters> & {
  teacherId: number;
};

export class SessionController implements Controller {
  constructor(
    private readonly action: SessionAction,
    private readonly dependencies: SessionDependencies,
  ) {}

  async handle(
    request: HttpRequest<CreateManualSessionInput, SessionParams, SessionListFilters, unknown, SessionContext>,
  ): Promise<HttpResponse> {
    try {
      switch (this.action) {
        case 'listSessions':
          return this.listSessions(request);
        case 'listClassSessions':
          return this.listClassSessions(request);
        case 'createManualSession':
          return this.createManualSession(request);
        case 'cancelSession':
          return this.cancelSession(request);
      }
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw error;
    }
  }

  private async listSessions(
    request: HttpRequest<unknown, SessionParams, SessionListFilters, unknown, SessionContext>,
  ): Promise<HttpResponse> {
    const sessions = await this.dependencies.sessions.listSessions(
      request.context.teacherId,
      request.query ?? {},
    );

    return {
      statusCode: 200,
      body: { sessions },
    };
  }

  private async listClassSessions(
    request: HttpRequest<unknown, SessionParams, SessionListFilters, unknown, SessionContext>,
  ): Promise<HttpResponse> {
    const { status, from, to } = request.query ?? {};
    const sessions = await this.dependencies.sessions.listSessions(
      request.context.teacherId,
      {
        status,
        from,
        to,
        class_id: request.context.params.classId,
      },
    );``

    return {
      statusCode: 200,
      body: { sessions },
    };
  }

  private async createManualSession(
    request: HttpRequest<CreateManualSessionInput, SessionParams, unknown, unknown, SessionContext>,
  ): Promise<HttpResponse> {
    const session = await this.dependencies.commandHandlers.createManualSession({
      teacherId: request.context.teacherId,
      classId: request.context.params.classId,
      session: request.body,
    });

    return {
      statusCode: 201,
      body: { session },
    };
  }

  private async cancelSession(
    request: HttpRequest<unknown, SessionParams, unknown, unknown, SessionContext>,
  ): Promise<HttpResponse> {
    const session = await this.dependencies.commandHandlers.cancelSession({
      teacherId: request.context.teacherId,
      sessionId: request.context.params.sessionId,
    });

    return {
      statusCode: 200,
      body: { session },
    };
  }
}
