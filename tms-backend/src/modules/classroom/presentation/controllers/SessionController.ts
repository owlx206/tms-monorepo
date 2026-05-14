import { ClassServiceError } from '../../../../shared/errors/class.error.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type {
  CreateManualSessionInput,
  SessionListFilters,
} from '../../application/dto/ClassDto.js';
import { SessionUseCase } from '../../application/queries/SessionUseCase.js';
import {
  getClassId,
  getSessionId,
  getTeacherId,
} from './request-context.js';

type SessionDependencies = {
  sessions: SessionUseCase;
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
  classId?: number;
  sessionId?: number;
};

export class SessionController implements Controller {
  constructor(
    private readonly action: SessionAction,
    private readonly dependencies: SessionDependencies,
  ) {}

  async handle(
    request: HttpRequest<CreateManualSessionInput, SessionParams, SessionListFilters>,
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
      if (error instanceof ClassServiceError) {
        throw error;
      }

      throw error;
    }
  }

  private async listSessions(
    request: HttpRequest<unknown, SessionParams, SessionListFilters>,
  ): Promise<HttpResponse> {
    const sessions = await this.dependencies.sessions.list(
      getTeacherId(request),
      request.query ?? {},
    );

    return {
      statusCode: 200,
      body: { sessions },
    };
  }

  private async listClassSessions(
    request: HttpRequest<unknown, SessionParams, SessionListFilters>,
  ): Promise<HttpResponse> {
    const { status, from, to } = request.query ?? {};
    const sessions = await this.dependencies.sessions.listForClass(
      getTeacherId(request),
      getClassId(request),
      { status, from, to },
    );

    return {
      statusCode: 200,
      body: { sessions },
    };
  }

  private async createManualSession(
    request: HttpRequest<CreateManualSessionInput, SessionParams>,
  ): Promise<HttpResponse> {
    const session = await this.dependencies.commandHandlers.createManualSession({
      teacherId: getTeacherId(request),
      classId: getClassId(request),
      session: request.body,
    });

    return {
      statusCode: 201,
      body: { session },
    };
  }

  private async cancelSession(
    request: HttpRequest<unknown, SessionParams>,
  ): Promise<HttpResponse> {
    const session = await this.dependencies.commandHandlers.cancelSession({
      teacherId: getTeacherId(request),
      sessionId: getSessionId(request),
    });

    return {
      statusCode: 200,
      body: { session },
    };
  }
}
