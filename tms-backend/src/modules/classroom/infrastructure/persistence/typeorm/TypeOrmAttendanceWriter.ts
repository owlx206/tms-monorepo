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
    const repo = this.manager.getRepository(Attendance);
    const existing = await repo.findOneBy({
      teacher_id: input.teacherId,
      session_id: input.sessionId,
      student_id: input.studentId,
    });

    if (!existing) {
      await repo.save(repo.create({
        teacher_id: input.teacherId,
        session_id: input.sessionId,
        student_id: input.studentId,
        status: AttendanceStatus.Present,
        source: AttendanceSource.Bot,
        overridden_at: null,
        notes: null,
      }));
      return true;
    }

    if (
      existing.source === AttendanceSource.Manual
      || existing.status === AttendanceStatus.AbsentExcused
    ) {
      return false;
    }

    existing.status = AttendanceStatus.Present;
    existing.source = AttendanceSource.Bot;
    existing.overridden_at = null;
    await repo.save(existing);
    return true;
  }

  remove(records: Attendance[]): Promise<Attendance[]> {
    return this.manager.getRepository(Attendance).remove(records);
  }
}
