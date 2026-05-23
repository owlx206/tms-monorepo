import { AttendanceSource, AttendanceStatus } from '../../contracts/types.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { AttendanceRecordSummary, UpsertSessionAttendanceCommand } from '../../contracts/types.js';
import type { TypeOrmSessionFinanceService } from '../../infrastructure/persistence/typeorm/Writer.js';
import { AttendanceMapper } from '../../infrastructure/persistence/typeorm/Writer.js';
import type { TypeOrmAttendanceWriter } from '../../infrastructure/persistence/typeorm/Writer.js';

export class UpsertSessionAttendanceUseCase {
  constructor(
    private readonly attendanceWriter: TypeOrmAttendanceWriter,
    private readonly finance: TypeOrmSessionFinanceService,
  ) {}

  async execute(command: UpsertSessionAttendanceCommand): Promise<AttendanceRecordSummary> {
    const session = await this.attendanceWriter.findSessionById(command.teacherId, command.sessionId);

    if (!session) {
      throw new HttpError('session not found', 404);
    }

    const classEntity = await this.attendanceWriter.findClassById(command.teacherId, session.class_id);

    if (!classEntity) {
      throw new HttpError('class not found', 404);
    }

    const student = await this.attendanceWriter.findStudentById(command.teacherId, command.studentId);

    if (!student) {
      throw new HttpError('student not found', 404);
    }

    const enrollment = await this.attendanceWriter.findEnrollmentAtSessionTime(
      command.teacherId,
      command.studentId,
      session.class_id,
      session.scheduled_at,
    );

    if (!enrollment) {
      throw new HttpError('student is not enrolled in class at this session', 409);
    }

    if (session.isCancelled()) {
      throw new HttpError('cannot update attendance for a cancelled session', 409);
    }

    let attendance = await this.attendanceWriter.findAttendanceForStudent(
      command.teacherId,
      command.sessionId,
      command.studentId,
    );

    if (!attendance) {
      attendance = this.attendanceWriter.create({
        teacher_id: command.teacherId,
        session_id: command.sessionId,
        student_id: command.studentId,
        status: command.attendance.status,
        source: AttendanceSource.Manual,
        overridden_at: new Date(),
        notes: command.attendance.notes ?? null,
      });
    } else {
      attendance.status = command.attendance.status;
      attendance.source = AttendanceSource.Manual;
      attendance.overridden_at = new Date();
      if (command.attendance.notes !== undefined) {
        attendance.notes = command.attendance.notes;
      }
    }

    const saved = await this.attendanceWriter.save(attendance);

    const shouldCharge = command.attendance.status === AttendanceStatus.Present
      || command.attendance.status === AttendanceStatus.AbsentUnexcused;

    await this.finance.syncAttendanceFeeRecord({
      teacherId: command.teacherId,
      sessionId: session.id,
      studentId: command.studentId,
      enrollmentId: enrollment.id,
      amount: classEntity.fee_per_session,
      shouldCharge,
    });

    return AttendanceMapper.toSummary(saved);
  }
}
