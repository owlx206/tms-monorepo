import type { Enrollment } from '../../../../../entities/enrollment.entity.js';
import type { Student } from '../../../../../entities/student.entity.js';
import type { Attendance } from '../../../../../entities/attendance.entity.js';
import type { Class } from '../../../../../entities/class.entity.js';
import type { Session } from '../../../../../entities/session.entity.js';

export interface AttendanceRepository {
  findSessionById(teacherId: number, sessionId: number): Promise<Session | null>;
  findClassById(teacherId: number, classId: number): Promise<Class | null>;
  findStudentById(teacherId: number, studentId: number): Promise<Student | null>;
  findEnrollmentAtSessionTime(
    teacherId: number,
    studentId: number,
    classId: number,
    scheduledAt: Date,
  ): Promise<Enrollment | null>;
  findEnrollmentsAtSessionTime(
    teacherId: number,
    classId: number,
    scheduledAt: Date,
  ): Promise<Enrollment[]>;
  findAttendanceForStudent(
    teacherId: number,
    sessionId: number,
    studentId: number,
  ): Promise<Attendance | null>;
  findAttendanceBySession(teacherId: number, sessionId: number): Promise<Attendance[]>;
  create(input: {
    teacher_id: number;
    session_id: number;
    student_id: number;
    status: Attendance['status'];
    source: Attendance['source'];
    overridden_at: Date | null;
    notes: string | null;
  }): Attendance;
  save(attendance: Attendance): Promise<Attendance>;
  remove(records: Attendance[]): Promise<Attendance[]>;
}
