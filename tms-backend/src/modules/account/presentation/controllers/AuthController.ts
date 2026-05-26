import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type { ParsedRequestContext } from '../../../../infrastructure/http/request-context.js';
import type { LoginInput, RegisterInput, UpdateTeacherInput } from '../../contracts/types.js';

type AuthControllerAction =
  | 'register'
  | 'login'
  | 'me'
  | 'updateMe'
  | 'startDiscordVerification'
  | 'completeDiscordVerification';

type AuthControllerDependencies = {
  register: { execute(input: RegisterInput): Promise<unknown> };
  login: { execute(input: LoginInput): Promise<unknown> };
  me: { execute(teacherId: number): Promise<unknown> };
  updateMe: { execute(teacherId: number, input: UpdateTeacherInput): Promise<unknown> };
  linkTeacherDiscord: {
    buildAuthorizeUrl(teacherId: number): Promise<string>;
    handleCallback(input: { code?: string; state?: string; error?: string }): Promise<string>;
  };
};

export class AuthController implements Controller {
  constructor(
    private readonly action: AuthControllerAction,
    private readonly dependencies: AuthControllerDependencies,
  ) {}

  async handle(
    request: HttpRequest<unknown, { studentId: number }, unknown, unknown, ParsedRequestContext<unknown, { studentId: number }> & { teacherId: number }>,
  ): Promise<HttpResponse> {
    switch (this.action) {
      case 'register':
        return this.register(request);
      case 'login':
        return this.login(request);
      case 'me':
        return this.me(request);
      case 'updateMe':
        return this.updateMe(request);
      case 'startDiscordVerification':
        return this.startDiscordVerification(request);
      case 'completeDiscordVerification':
        return this.completeDiscordVerification(request);
    }
  }

  private async register(request: HttpRequest): Promise<HttpResponse> {
    const authResponse = await this.dependencies.register.execute(request.body as RegisterInput);
    return {
      statusCode: 201,
      body: authResponse,
    };
  }

  private async login(request: HttpRequest): Promise<HttpResponse> {
    const authResponse = await this.dependencies.login.execute(request.body as LoginInput);
    return {
      statusCode: 200,
      body: authResponse,
    };
  }

  private async me(request: HttpRequest<unknown, unknown, unknown, unknown, ParsedRequestContext & { teacherId: number }>): Promise<HttpResponse> {
    const teacher = await this.dependencies.me.execute(request.context.teacherId);

    return {
      statusCode: 200,
      body: { teacher },
    };
  }

  private async updateMe(request: HttpRequest<unknown, unknown, unknown, unknown, ParsedRequestContext & { teacherId: number }>): Promise<HttpResponse> {
    const updatedTeacher = await this.dependencies.updateMe.execute(
      request.context.teacherId,
      request.body as UpdateTeacherInput,
    );

    return {
      statusCode: 200,
      body: { teacher: updatedTeacher },
    };
  }

  private async startDiscordVerification(request: HttpRequest<unknown, unknown, unknown, unknown, ParsedRequestContext & { teacherId: number }>): Promise<HttpResponse> {
    const authorizeUrl = await this.dependencies.linkTeacherDiscord.buildAuthorizeUrl(request.context.teacherId);

    return {
      statusCode: 200,
      body: { authorize_url: authorizeUrl },
    };
  }

  private async completeDiscordVerification(request: HttpRequest): Promise<HttpResponse> {
    const redirectUrl = await this.dependencies.linkTeacherDiscord.handleCallback(
      (request.query ?? {}) as { code?: string; state?: string; error?: string },
    );

    return {
      statusCode: 302,
      body: {
        redirect_to: redirectUrl,
      },
      headers: {
        Location: redirectUrl,
      },
    };
  }

}
