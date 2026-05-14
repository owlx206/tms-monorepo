import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type {
  AttendanceListFilters,
  UpsertSessionAttendanceInput,
} from '../../application/dto/AttendanceDto.js';
import { AttendanceUseCase } from '../../application/queries/AttendanceUseCase.js';
import {
  getSessionId,
  getStudentId,
  getTeacherId,
} from './request-context.js';

type AttendanceAction =
  | 'getSessionAttendance'
  | 'syncSessionAttendance'
  | 'upsertSessionAttendance'
  | 'listAttendanceRecords'
  | 'resetSessionAttendance';

type AttendanceParams = {
  sessionId?: number;
  studentId?: number;
};

type AttendanceDependencies = {
  attendance: AttendanceUseCase;
  commandHandlers: {
    upsertSessionAttendance(input: {
      teacherId: number;
      sessionId: number;
      studentId: number;
      attendance: UpsertSessionAttendanceInput;
    }): Promise<unknown>;
    syncSessionAttendance(input: {
      teacherId: number;
      sessionId: number;
    }): Promise<unknown>;
    resetSessionAttendance(input: {
      teacherId: number;
      sessionId: number;
    }): Promise<void>;
  };
};

export class AttendanceController implements Controller {
  constructor(
    private readonly action: AttendanceAction,
    private readonly dependencies: AttendanceDependencies,
  ) {}

  async handle(
    request: HttpRequest<UpsertSessionAttendanceInput, AttendanceParams, AttendanceListFilters>,
  ): Promise<HttpResponse> {
    switch (this.action) {
      case 'getSessionAttendance':
        return this.getSessionAttendance(request);
      case 'syncSessionAttendance':
        return this.syncSessionAttendance(request);
      case 'upsertSessionAttendance':
        return this.upsertSessionAttendance(request);
      case 'listAttendanceRecords':
        return this.listAttendanceRecords(request);
      case 'resetSessionAttendance':
        return this.resetSessionAttendance(request);
    }
  }

  private async getSessionAttendance(
    request: HttpRequest<unknown, AttendanceParams>,
  ): Promise<HttpResponse> {
    const data = await this.dependencies.attendance.getForSession(
      getTeacherId(request),
      getSessionId(request),
    );

    return {
      statusCode: 200,
      body: data,
    };
  }

  private async syncSessionAttendance(
    request: HttpRequest<unknown, AttendanceParams>,
  ): Promise<HttpResponse> {
    const result = await this.dependencies.commandHandlers.syncSessionAttendance({
      teacherId: getTeacherId(request),
      sessionId: getSessionId(request),
    });

    return {
      statusCode: 200,
      body: result,
    };
  }

  private async upsertSessionAttendance(
    request: HttpRequest<UpsertSessionAttendanceInput, AttendanceParams>,
  ): Promise<HttpResponse> {
    const attendance = await this.dependencies.commandHandlers.upsertSessionAttendance({
      teacherId: getTeacherId(request),
      sessionId: getSessionId(request),
      studentId: getStudentId(request),
      attendance: request.body,
    });

    return {
      statusCode: 200,
      body: { attendance },
    };
  }

  private async listAttendanceRecords(
    request: HttpRequest<unknown, AttendanceParams, AttendanceListFilters>,
  ): Promise<HttpResponse> {
    const attendance = await this.dependencies.attendance.listRecords(
      getTeacherId(request),
      request.query ?? {},
    );

    return {
      statusCode: 200,
      body: { attendance },
    };
  }

  private async resetSessionAttendance(
    request: HttpRequest<unknown, AttendanceParams>,
  ): Promise<HttpResponse> {
    await this.dependencies.commandHandlers.resetSessionAttendance({
      teacherId: getTeacherId(request),
      sessionId: getSessionId(request),
    });

    return {
      statusCode: 204,
      body: undefined,
    };
  }
}
