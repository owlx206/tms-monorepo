import { AuthError } from '../../../../shared/errors/auth.error.js';
import { ServiceError } from '../../../../shared/errors/service.error.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import { AuthReadService } from '../../application/queries/AuthReadService.js';
import type { LoginInput, RegisterInput, UpdateTeacherInput } from '../../application/dto/AuthDto.js';
import { getTeacher } from './request-context.js';

type AuthControllerAction =
  | 'register'
  | 'login'
  | 'me'
  | 'updateMe'
  | 'startDiscordVerification'
  | 'completeDiscordVerification';

type AuthControllerDependencies = {
  readService: AuthReadService;
  register: { execute(input: RegisterInput): Promise<unknown> };
  login: { execute(input: LoginInput): Promise<unknown> };
  updateMe: { execute(teacherId: number, input: UpdateTeacherInput): Promise<unknown> };
  startDiscordVerification: { execute(teacherId: number): Promise<string> };
  completeDiscordVerification: {
    execute(input: { code?: string; state?: string; error?: string }): Promise<string>;
  };
};

export class AuthController implements Controller {
  constructor(
    private readonly action: AuthControllerAction,
    private readonly dependencies: AuthControllerDependencies,
  ) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    try {
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
    } catch (error) {
      if (error instanceof AuthError || error instanceof ServiceError) {
        throw error;
      }

      throw error;
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

  private async me(request: HttpRequest): Promise<HttpResponse> {
    return {
      statusCode: 200,
      body: {
        teacher: this.dependencies.readService.me(getTeacher(request)),
      },
    };
  }

  private async updateMe(request: HttpRequest): Promise<HttpResponse> {
    const teacher = getTeacher(request);
    const updatedTeacher = await this.dependencies.updateMe.execute(
      teacher.id,
      request.body as UpdateTeacherInput,
    );

    return {
      statusCode: 200,
      body: { teacher: updatedTeacher },
    };
  }

  private async startDiscordVerification(request: HttpRequest): Promise<HttpResponse> {
    const teacher = getTeacher(request);
    const authorizeUrl = await this.dependencies.startDiscordVerification.execute(teacher.id);

    return {
      statusCode: 200,
      body: { authorize_url: authorizeUrl },
    };
  }

  private async completeDiscordVerification(request: HttpRequest): Promise<HttpResponse> {
    const redirectUrl = await this.dependencies.completeDiscordVerification.execute(
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
