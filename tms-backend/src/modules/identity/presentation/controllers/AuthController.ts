import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type { ParsedRequestContext } from '../../../../infrastructure/http/request-context.js';
import { GetCurrentTeacherUseCase } from '../../application/queries/GetCurrentTeacherUseCase.js';
import type { LoginInput, RegisterInput, UpdateTeacherInput } from '../../contracts/types.js';

type AuthControllerAction =
  | 'register'
  | 'login'
  | 'me'
  | 'updateMe'
  | 'startDiscordVerification'
  | 'completeDiscordVerification'
  | 'startStudentDiscordAuthorization'
  | 'completeStudentDiscordAuthorization';

type AuthControllerDependencies = {
  getCurrentTeacher: GetCurrentTeacherUseCase;
  register: { execute(input: RegisterInput): Promise<unknown> };
  login: { execute(input: LoginInput): Promise<unknown> };
  updateMe: { execute(teacherId: number, input: UpdateTeacherInput): Promise<unknown> };
  startDiscordVerification: { execute(teacherId: number): Promise<string> };
  completeDiscordVerification: {
    execute(input: { code?: string; state?: string; error?: string }): Promise<string>;
  };
  startStudentDiscordAuthorization: { execute(teacherId: number, studentId: number): Promise<string> };
  completeStudentDiscordAuthorization: {
    execute(input: { code?: string; state?: string; error?: string }): Promise<string>;
  };
};

function renderStudentDiscordClosePage(status: string): string {
  const safeStatus = status.replace(/[^a-z0-9_]/gi, '');
  const isSuccess = safeStatus === 'success';
  const title = isSuccess ? 'Discord authorization completed' : 'Discord authorization received';
  const message = isSuccess
    ? 'Your Discord account has been connected. This tab will close automatically.'
    : 'Your Discord authorization was processed. This tab will close automatically.';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fafafa; color: #18181b; }
    main { max-width: 420px; padding: 32px; text-align: center; }
    h1 { margin: 0 0 12px; font-size: 22px; }
    p { margin: 0; color: #52525b; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${message}</p>
    <p>If the tab does not close, you can close it now.</p>
  </main>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'student-discord-authorization', status: '${safeStatus}' }, '*');
      }
    } catch (_) {}
    setTimeout(function () {
      window.close();
    }, 300);
  </script>
</body>
</html>`;
}

export class AuthController implements Controller {
  constructor(
    private readonly action: AuthControllerAction,
    private readonly dependencies: AuthControllerDependencies,
  ) {}

  async handle(
    request: HttpRequest<unknown, { studentId: number }, unknown, unknown, ParsedRequestContext<unknown, { studentId: number }> & { teacherId: number }>,
  ): Promise<HttpResponse> {
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
        case 'startStudentDiscordAuthorization':
          return this.startStudentDiscordAuthorization(request);
        case 'completeStudentDiscordAuthorization':
          return this.completeStudentDiscordAuthorization(request);
      }
    } catch (error) {
      if (error instanceof HttpError) {
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

  private async me(request: HttpRequest<unknown, unknown, unknown, unknown, ParsedRequestContext & { teacherId: number }>): Promise<HttpResponse> {
    return {
      statusCode: 200,
      body: {
        teacher: this.dependencies.getCurrentTeacher.execute(request.context.teacher!),
      },
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
    const authorizeUrl = await this.dependencies.startDiscordVerification.execute(request.context.teacherId);

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

  private async startStudentDiscordAuthorization(
    request: HttpRequest<unknown, { studentId: number }, unknown, unknown, ParsedRequestContext<unknown, { studentId: number }> & { teacherId: number }>,
  ): Promise<HttpResponse> {
    const authorizeUrl = await this.dependencies.startStudentDiscordAuthorization.execute(
      request.context.teacherId,
      request.context.params.studentId,
    );

    return {
      statusCode: 200,
      body: { authorize_url: authorizeUrl },
    };
  }

  private async completeStudentDiscordAuthorization(request: HttpRequest): Promise<HttpResponse> {
    const status = await this.dependencies.completeStudentDiscordAuthorization.execute(
      (request.query ?? {}) as { code?: string; state?: string; error?: string },
    );

    return {
      statusCode: 200,
      body: renderStudentDiscordClosePage(status),
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    };
  }
}
