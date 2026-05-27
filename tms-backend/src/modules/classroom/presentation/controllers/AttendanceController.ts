import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type { ParsedRequestContext } from '../../../../infrastructure/http/request-context.js';
import type {
  AttendanceListFilters,
  AttendanceRecordSummary,
  SessionAttendanceSummary,
  UpsertSessionAttendanceInput,
} from '../../contracts/types.js';

type AttendanceAction =
  | 'getSessionAttendance'
  | 'upsertSessionAttendance'
  | 'listAttendanceRecords';

type AttendanceParams = {
  sessionId: number;
  studentId: number;
};
type AttendanceContext = ParsedRequestContext<
  UpsertSessionAttendanceInput,
  AttendanceParams,
  AttendanceListFilters
> & { teacherId: number };

type AttendanceDependencies = {
  attendance: {
    getSessionAttendance(teacherId: number, sessionId: number): Promise<SessionAttendanceSummary>;
    listAttendanceRecords(teacherId: number, filters: AttendanceListFilters): Promise<AttendanceRecordSummary[]>;
  };
  commandHandlers: {
    upsertSessionAttendance(input: {
      teacherId: number;
      sessionId: number;
      studentId: number;
      attendance: UpsertSessionAttendanceInput;
    }): Promise<unknown>;
  };
};

export class AttendanceController implements Controller {
  constructor(
    private readonly action: AttendanceAction,
    private readonly dependencies: AttendanceDependencies,
  ) {}

  async handle(
    request: HttpRequest<UpsertSessionAttendanceInput, AttendanceParams, AttendanceListFilters, unknown, AttendanceContext>,
  ): Promise<HttpResponse> {
    switch (this.action) {
      case 'getSessionAttendance':
        return this.getSessionAttendance(request);
      case 'upsertSessionAttendance':
        return this.upsertSessionAttendance(request);
      case 'listAttendanceRecords':
        return this.listAttendanceRecords(request);
    }
  }

  private async getSessionAttendance(
    request: HttpRequest<unknown, AttendanceParams, unknown, unknown, AttendanceContext>,
  ): Promise<HttpResponse> {
    const data = await this.dependencies.attendance.getSessionAttendance(
      request.context.teacherId,
      request.context.params.sessionId,
    );

    return {
      statusCode: 200,
      body: data,
    };
  }

  private async upsertSessionAttendance(
    request: HttpRequest<UpsertSessionAttendanceInput, AttendanceParams, unknown, unknown, AttendanceContext>,
  ): Promise<HttpResponse> {
    const attendance = await this.dependencies.commandHandlers.upsertSessionAttendance({
      teacherId: request.context.teacherId,
      sessionId: request.context.params.sessionId,
      studentId: request.context.params.studentId,
      attendance: request.body,
    });

    return {
      statusCode: 200,
      body: { attendance },
    };
  }

  private async listAttendanceRecords(
    request: HttpRequest<unknown, AttendanceParams, AttendanceListFilters, unknown, AttendanceContext>,
  ): Promise<HttpResponse> {
    const attendance = await this.dependencies.attendance.listAttendanceRecords(
      request.context.teacherId,
      request.query ?? {},
    );

    return {
      statusCode: 200,
      body: { attendance },
    };
  }
}
