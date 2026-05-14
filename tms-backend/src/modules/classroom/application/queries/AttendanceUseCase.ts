import type {
  AttendanceListFilters,
  AttendanceRecordSummary,
  SessionAttendanceSummary,
} from '../dto/AttendanceDto.js';

type AttendanceReader = {
  getSessionAttendance(teacherId: number, sessionId: number): Promise<SessionAttendanceSummary>;
  listAttendanceRecords(teacherId: number, filters: AttendanceListFilters): Promise<AttendanceRecordSummary[]>;
};

export class AttendanceUseCase {
  constructor(private readonly attendance: AttendanceReader) {}

  getForSession(teacherId: number, sessionId: number): Promise<SessionAttendanceSummary> {
    return this.attendance.getSessionAttendance(teacherId, sessionId);
  }

  listRecords(
    teacherId: number,
    filters: AttendanceListFilters,
  ): Promise<AttendanceRecordSummary[]> {
    return this.attendance.listAttendanceRecords(teacherId, filters);
  }
}
