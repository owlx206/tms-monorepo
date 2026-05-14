import type { EntityManager } from 'typeorm';

import { SessionStatus } from '../../../../../entities/enums.js';
import { ClassServiceError } from '../../../../../shared/errors/class.error.js';
import type {
  AttendanceListFilters,
  AttendanceRecordSummary,
  SessionAttendanceSummary,
} from '../../../application/dto/AttendanceDto.js';
import { Attendance } from '../../../../../entities/attendance.entity.js';
import { Session } from '../../../../../entities/session.entity.js';

type SessionAttendanceRow = SessionAttendanceSummary['attendance'][number];

export class TypeOrmAttendanceReader {
  constructor(private readonly manager: EntityManager) {}

  async getSessionAttendance(teacherId: number, sessionId: number): Promise<SessionAttendanceSummary> {
    const session = await this.manager.getRepository(Session).findOneBy({
      id: sessionId,
      teacher_id: teacherId,
    });

    if (!session) {
      throw new ClassServiceError('session not found', 404);
    }

    const attendanceRecords = await this.manager.getRepository(Attendance).find({
      where: {
        teacher_id: teacherId,
        session_id: sessionId,
      },
    });

    const studentRows = await this.manager.query(
      `
        SELECT
          student.id AS student_id,
          student.full_name AS student_name,
          student.status AS student_status
        FROM students AS student
        INNER JOIN enrollments AS enrollment
          ON enrollment.teacher_id = student.teacher_id
          AND enrollment.student_id = student.id
          AND enrollment.class_id = $2
          AND enrollment.enrolled_at <= $3
          AND (enrollment.unenrolled_at IS NULL OR enrollment.unenrolled_at > $3)
        WHERE student.teacher_id = $1
        ORDER BY student.full_name ASC
      `,
      [teacherId, session.class_id, session.scheduled_at],
    ) as Array<{
      student_id: number | string;
      student_name: string;
      student_status: SessionAttendanceRow['student_status'];
    }>;

    const attendanceByStudentId = new Map<number, Attendance>();
    attendanceRecords.forEach((record) => {
      attendanceByStudentId.set(record.student_id, record);
    });

    return {
      session: {
        id: session.id,
        teacher_id: session.teacher_id,
        class_id: session.class_id,
        scheduled_at: session.scheduled_at,
        end_time: session.end_time,
        status: session.status as SessionStatus,
        is_manual: session.is_manual,
        created_at: session.created_at,
        cancelled_at: session.cancelled_at,
      },
      attendance: studentRows.map((student) => {
        const studentId = Number(student.student_id);
        const attendance = attendanceByStudentId.get(studentId);

        return {
          student_id: studentId,
          student_name: student.student_name,
          student_status: student.student_status,
          attendance_id: attendance?.id ?? null,
          attendance_status: attendance?.status ?? null,
          source: attendance?.source ?? null,
          notes: attendance?.notes ?? null,
          overridden_at: attendance?.overridden_at ?? null,
        };
      }),
    };
  }

  async listAttendanceRecords(
    teacherId: number,
    filters: AttendanceListFilters,
  ): Promise<AttendanceRecordSummary[]> {
    const records = await this.manager.getRepository(Attendance).find({
      where: {
        teacher_id: teacherId,
        ...(filters.session_id !== undefined ? { session_id: filters.session_id } : {}),
        ...(filters.student_id !== undefined ? { student_id: filters.student_id } : {}),
        ...(filters.status !== undefined ? { status: filters.status } : {}),
      },
      order: {
        id: 'DESC',
      },
    });

    return records.map((record) => ({
      id: record.id,
      teacher_id: record.teacher_id,
      session_id: record.session_id,
      student_id: record.student_id,
      status: record.status,
      source: record.source,
      overridden_at: record.overridden_at,
      notes: record.notes,
    }));
  }
}
