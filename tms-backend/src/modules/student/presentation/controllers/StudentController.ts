import { DomainError } from '../../../../shared/domain/DomainError.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type { ParsedRequestContext } from '../../../../infrastructure/http/request-context.js';
import type {
  ArchivePendingStudentInput,
  CreateStudentInput,
  ReinstateStudentInput,
  StudentMessageInput,
  StudentListFilters,
  StudentSummary,
  TransferStudentInput,
  UpdateStudentInput,
  WithdrawStudentInput,
} from '../../contracts/types.js';

type StudentControllerDependencies = {
  students: {
    listStudents(teacherId: number, filters: StudentListFilters): Promise<StudentSummary[]>;
    getStudentById(teacherId: number, studentId: number): Promise<StudentSummary>;
    listStudentEnrollments(teacherId: number, studentId: number): Promise<unknown>;
  };
  createStudent: {
    execute(input: {
      teacherId: number;
      fullName: string;
      classId: number;
      codeforcesHandle: string;
      phone: string | null;
      note: string | null;
      enrolledAt: Date;
    }): Promise<StudentSummary>;
  };
  updateStudent: {
    execute(input: {
      teacherId: number;
      studentId: number;
      fullName?: string;
      codeforcesHandle?: string;
      phone?: string | null;
      note?: string | null;
    }): Promise<StudentSummary>;
  };
  inviteStudentToCurrentClass: {
    execute(input: {
      teacherId: number;
      studentId: number;
    }): Promise<{ sent: boolean; reason: string | null }>;
  };
  getStudentDiscordAuthorizationUrl: {
    buildAuthorizeUrl(teacherId: number, studentId: number): Promise<string>;
    handleCallback(input: { code?: string; state?: string; error?: string }): Promise<string>;
  };
  sendStudentMessages: {
    execute(teacherId: number, input: StudentMessageInput): Promise<unknown>;
  };
  transferStudent: {
    execute(input: {
      teacherId: number;
      studentId: number;
      toClassId: number;
      transferredAt: Date;
    }): Promise<StudentSummary>;
  };
  withdrawStudent: {
    execute(input: {
      teacherId: number;
      studentId: number;
      withdrawnAt: Date;
    }): Promise<StudentSummary>;
  };
  reinstateStudent: {
    execute(input: {
      teacherId: number;
      studentId: number;
      classId: number;
      enrolledAt: Date;
    }): Promise<StudentSummary>;
  };
  archivePendingStudent: {
    execute(input: {
      teacherId: number;
      studentId: number;
      archivedAt: Date;
    }): Promise<StudentSummary>;
  };
};

type StudentControllerAction =
  | 'listStudents'
  | 'getStudentById'
  | 'createStudent'
  | 'updateStudent'
  | 'listStudentEnrollments'
  | 'inviteStudentToCurrentClass'
  | 'getStudentDiscordAuthorizationUrl'
  | 'completeStudentDiscordAuthorization'
  | 'sendStudentMessage'
  | 'sendStudentMessages'
  | 'transferStudent'
  | 'withdrawStudent'
  | 'reinstateStudent'
  | 'archivePendingStudent';

type StudentHttpRequest = HttpRequest<
  | CreateStudentInput
  | UpdateStudentInput
  | StudentMessageInput
  | TransferStudentInput
  | WithdrawStudentInput
  | ReinstateStudentInput
  | ArchivePendingStudentInput,
  { studentId: number },
  StudentListFilters,
  unknown,
  ParsedRequestContext<unknown, { studentId: number }, StudentListFilters> & { teacherId: number }
>;

export class StudentController implements Controller {
  constructor(
    private readonly action: StudentControllerAction,
    private readonly dependencies: StudentControllerDependencies,
  ) {}

  async handle(request: StudentHttpRequest): Promise<HttpResponse> {
    return this.executeWithDomainErrorMapping(async () => {
      switch (this.action) {
        case 'listStudents':
          return this.listStudents(request);
        case 'getStudentById':
          return this.getStudentById(request);
        case 'createStudent':
          return this.createStudent(request);
        case 'updateStudent':
          return this.updateStudent(request);
        case 'listStudentEnrollments':
          return this.listStudentEnrollments(request);
        case 'inviteStudentToCurrentClass':
          return this.inviteStudentToCurrentClass(request);
        case 'getStudentDiscordAuthorizationUrl':
          return this.getStudentDiscordAuthorizationUrl(request);
        case 'completeStudentDiscordAuthorization':
          return this.completeStudentDiscordAuthorization(request);
        case 'sendStudentMessage':
          return this.sendStudentMessage(request);
        case 'sendStudentMessages':
          return this.sendStudentMessages(request);
        case 'transferStudent':
          return this.transferStudent(request);
        case 'withdrawStudent':
          return this.withdrawStudent(request);
        case 'reinstateStudent':
          return this.reinstateStudent(request);
        case 'archivePendingStudent':
          return this.archivePendingStudent(request);
      }
    });
  }

  private async listStudents(request: StudentHttpRequest): Promise<HttpResponse> {
    const students = await this.dependencies.students.listStudents(
      request.context.teacherId,
      request.query ?? {},
    );

    return {
      statusCode: 200,
      body: { students },
    };
  }

  private async getStudentById(request: StudentHttpRequest): Promise<HttpResponse> {
    const student = await this.dependencies.students.getStudentById(
      request.context.teacherId,
      request.context.params.studentId,
    );

    return {
      statusCode: 200,
      body: { student },
    };
  }

  private async createStudent(request: StudentHttpRequest): Promise<HttpResponse> {
    const input = request.body as CreateStudentInput;
    const student = await this.dependencies.createStudent.execute({
      teacherId: request.context.teacherId,
      fullName: input.full_name,
      classId: input.class_id,
      codeforcesHandle: input.codeforces_handle,
      phone: input.phone,
      note: input.note,
      enrolledAt: input.enrolled_at,
    });

    return {
      statusCode: 201,
      body: { student },
    };
  }

  private async updateStudent(request: StudentHttpRequest): Promise<HttpResponse> {
    const input = request.body as UpdateStudentInput;
    const student = await this.dependencies.updateStudent.execute({
      teacherId: request.context.teacherId,
      studentId: request.context.params.studentId,
      fullName: input.full_name,
      codeforcesHandle: input.codeforces_handle,
      phone: input.phone,
      note: input.note,
    });

    return {
      statusCode: 200,
      body: { student },
    };
  }

  private async listStudentEnrollments(request: StudentHttpRequest): Promise<HttpResponse> {
    const enrollments = await this.dependencies.students.listStudentEnrollments(
      request.context.teacherId,
      request.context.params.studentId,
    );

    return {
      statusCode: 200,
      body: { enrollments },
    };
  }

  private async inviteStudentToCurrentClass(request: StudentHttpRequest): Promise<HttpResponse> {
    const result = await this.dependencies.inviteStudentToCurrentClass.execute({
      teacherId: request.context.teacherId,
      studentId: request.context.params.studentId,
    });

    return {
      statusCode: 200,
      body: result,
    };
  }

  private async getStudentDiscordAuthorizationUrl(request: StudentHttpRequest): Promise<HttpResponse> {
    const authorizeUrl = await this.dependencies.getStudentDiscordAuthorizationUrl.buildAuthorizeUrl(
      request.context.teacherId,
      request.context.params.studentId,
    );

    return {
      statusCode: 200,
      body: { authorize_url: authorizeUrl },
    };
  }

  private async completeStudentDiscordAuthorization(request: HttpRequest): Promise<HttpResponse> {
    const status = await this.dependencies.getStudentDiscordAuthorizationUrl.handleCallback(
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

  private async sendStudentMessage(request: StudentHttpRequest): Promise<HttpResponse> {
    const input = request.body as StudentMessageInput;
    const result = await this.dependencies.sendStudentMessages.execute(
      request.context.teacherId,
      {
        content: input.content,
        student_ids: [request.context.params.studentId],
      },
    );

    return {
      statusCode: 200,
      body: result,
    };
  }

  private async sendStudentMessages(request: StudentHttpRequest): Promise<HttpResponse> {
    const result = await this.dependencies.sendStudentMessages.execute(
      request.context.teacherId,
      request.body as StudentMessageInput,
    );

    return {
      statusCode: 200,
      body: result,
    };
  }

  private async transferStudent(request: StudentHttpRequest): Promise<HttpResponse> {
    const input = request.body as TransferStudentInput;
    const teacherId = request.context.teacherId;
    const studentId = request.context.params.studentId;
    const student = await this.dependencies.transferStudent.execute({
      teacherId,
      studentId,
      toClassId: input.to_class_id,
      transferredAt: input.transferred_at,
    });

    return {
      statusCode: 200,
      body: { student },
    };
  }

  private async withdrawStudent(request: StudentHttpRequest): Promise<HttpResponse> {
    const input = request.body as WithdrawStudentInput;
    const teacherId = request.context.teacherId;
    const studentId = request.context.params.studentId;
    const student = await this.dependencies.withdrawStudent.execute({
      teacherId,
      studentId,
      withdrawnAt: input.withdrawn_at,
    });

    return {
      statusCode: 200,
      body: { student },
    };
  }

  private async reinstateStudent(request: StudentHttpRequest): Promise<HttpResponse> {
    const input = request.body as ReinstateStudentInput;
    const student = await this.dependencies.reinstateStudent.execute({
      teacherId: request.context.teacherId,
      studentId: request.context.params.studentId,
      classId: input.class_id,
      enrolledAt: input.enrolled_at,
    });

    return {
      statusCode: 200,
      body: { student },
    };
  }

  private async archivePendingStudent(request: StudentHttpRequest): Promise<HttpResponse> {
    const input = request.body as ArchivePendingStudentInput;
    const student = await this.dependencies.archivePendingStudent.execute({
      teacherId: request.context.teacherId,
      studentId: request.context.params.studentId,
      archivedAt: input.archived_at,
    });

    return {
      statusCode: 200,
      body: { student },
    };
  }

  private async executeWithDomainErrorMapping<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof DomainError) {
        throw new HttpError(error.message, mapDomainErrorStatus(error.code));
      }

      throw error;
    }
  }
}

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

function mapDomainErrorStatus(code: string): number {
  switch (code) {
    case 'codeforces_handle_already_exists':
      return 409;
    case 'student_full_name_required':
    case 'codeforces_handle_required':
    case 'codeforces_handle_too_long':
    case 'invalid_class_id':
    case 'transferred_at_must_be_later_than_current_enrollment_start_time':
    case 'withdrawn_at_must_be_later_than_current_enrollment_start_time':
    case 'enrolled_at_must_be_later_than_archived_at':
    case 'archived_at_must_be_later_than_current_enrollment_start_time':
    case 'unenrolled_at_must_be_later_than_enrolled_at':
      return 400;
    case 'student_not_found':
      return 404;
    case 'student_already_enrolled_in_class':
    case 'student_already_has_active_enrollment':
    case 'student_balance_must_be_zero_before_archive':
    case 'student_has_no_active_enrollment':
    case 'student_is_not_active':
    case 'student_is_not_archived':
    case 'student_is_not_pending_archive':
      return 409;
    default:
      return 400;
  }
}
