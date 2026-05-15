import type { EntityManager } from 'typeorm';

import { Enrollment } from '../../../../../entities/enrollment.entity.js';
import { Student } from '../../../../../entities/student.entity.js';
import { Attendance } from '../../../../../entities/attendance.entity.js';
import { Class } from '../../../../../entities/class.entity.js';
import { Session } from '../../../../../entities/session.entity.js';
import { AttendanceSource, AttendanceStatus } from '../../../../../entities/enums.js';

export class TypeOrmAttendanceWriter {
  constructor(private readonly manager: EntityManager) {}

  findSessionById(teacherId: number, sessionId: number): Promise<Session | null> {
    return this.manager.getRepository(Session).findOneBy({
      id: sessionId,
      teacher_id: teacherId,
    });
  }

  findClassById(teacherId: number, classId: number): Promise<Class | null> {
    return this.manager.getRepository(Class).findOneBy({
      id: classId,
      teacher_id: teacherId,
    });
  }

  findStudentById(teacherId: number, studentId: number): Promise<Student | null> {
    return this.manager.getRepository(Student).findOneBy({
      id: studentId,
      teacher_id: teacherId,
    });
  }

  findEnrollmentAtSessionTime(
    teacherId: number,
    studentId: number,
    classId: number,
    scheduledAt: Date,
  ): Promise<Enrollment | null> {
    return this.manager
      .getRepository(Enrollment)
      .createQueryBuilder('enrollment')
      .where('enrollment.teacher_id = :teacherId', { teacherId })
      .andWhere('enrollment.student_id = :studentId', { studentId })
      .andWhere('enrollment.class_id = :classId', { classId })
      .andWhere('enrollment.enrolled_at <= :scheduledAt', { scheduledAt })
      .andWhere('(enrollment.unenrolled_at IS NULL OR enrollment.unenrolled_at > :scheduledAt)', { scheduledAt })
      .orderBy('enrollment.enrolled_at', 'DESC')
      .getOne();
  }

  findEnrollmentsAtSessionTime(
    teacherId: number,
    classId: number,
    scheduledAt: Date,
  ): Promise<Enrollment[]> {
    return this.manager
      .getRepository(Enrollment)
      .createQueryBuilder('enrollment')
      .where('enrollment.teacher_id = :teacherId', { teacherId })
      .andWhere('enrollment.class_id = :classId', { classId })
      .andWhere('enrollment.enrolled_at <= :scheduledAt', { scheduledAt })
      .andWhere('(enrollment.unenrolled_at IS NULL OR enrollment.unenrolled_at > :scheduledAt)', { scheduledAt })
      .orderBy('enrollment.enrolled_at', 'DESC')
      .getMany();
  }

  findAttendanceForStudent(
    teacherId: number,
    sessionId: number,
    studentId: number,
  ): Promise<Attendance | null> {
    return this.manager.getRepository(Attendance).findOneBy({
      teacher_id: teacherId,
      session_id: sessionId,
      student_id: studentId,
    });
  }

  findAttendanceBySession(teacherId: number, sessionId: number): Promise<Attendance[]> {
    return this.manager.getRepository(Attendance).find({
      where: {
        teacher_id: teacherId,
        session_id: sessionId,
      },
    });
  }

  create(input: {
    teacher_id: number;
    session_id: number;
    student_id: number;
    status: Attendance['status'];
    source: Attendance['source'];
    overridden_at: Date | null;
    notes: string | null;
  }): Attendance {
    return this.manager.getRepository(Attendance).create(input);
  }

  save(attendance: Attendance): Promise<Attendance> {
    return this.manager.getRepository(Attendance).save(attendance);
  }

  async markBotPresentIfNotManual(input: {
    teacherId: number;
    sessionId: number;
    studentId: number;
  }): Promise<boolean> {
    const rows = await this.manager.query(`
      INSERT INTO attendance (
        teacher_id,
        session_id,
        student_id,
        status,
        source,
        overridden_at,
        notes
      )
      VALUES (
        $1,
        $2,
        $3,
        $4::attendance_status,
        $5::attendance_source,
        NULL,
        NULL
      )
      ON CONFLICT (session_id, student_id) DO UPDATE
      SET
        status = EXCLUDED.status,
        source = EXCLUDED.source,
        overridden_at = NULL
      WHERE attendance.source <> $6::attendance_source
        AND attendance.status <> $7::attendance_status
      RETURNING id
    `, [
      input.teacherId,
      input.sessionId,
      input.studentId,
      AttendanceStatus.Present,
      AttendanceSource.Bot,
      AttendanceSource.Manual,
      AttendanceStatus.AbsentExcused,
    ]) as Array<{ id: number }>;

    return rows.length > 0;
  }

  remove(records: Attendance[]): Promise<Attendance[]> {
    return this.manager.getRepository(Attendance).remove(records);
  }
}
