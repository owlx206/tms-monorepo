import { AttendanceSource, AttendanceStatus } from '../../../../entities/enums.js';
import { ClassServiceError } from '../../../../shared/errors/class.error.js';
import type { TypeOrmSessionFinanceService } from '../../infrastructure/persistence/typeorm/TypeOrmSessionFinanceService.js';
import type { TypeOrmAttendanceWriter } from '../../infrastructure/persistence/typeorm/TypeOrmAttendanceWriter.js';

type MaterializeSessionAttendanceCommand = {
  teacherId: number;
  sessionId: number;
};

export class MaterializeSessionAttendanceUseCase {
  constructor(
    private readonly attendanceWriter: TypeOrmAttendanceWriter,
    private readonly finance: TypeOrmSessionFinanceService,
  ) {}

  async execute(command: MaterializeSessionAttendanceCommand): Promise<{
    attendance_created: number;
    fee_records_synced: number;
  }> {
    const session = await this.attendanceWriter.findSessionById(command.teacherId, command.sessionId);

    if (!session) {
      throw new ClassServiceError('session not found', 404);
    }

    if (session.isCancelled()) {
      return {
        attendance_created: 0,
        fee_records_synced: 0,
      };
    }

    const classEntity = await this.attendanceWriter.findClassById(command.teacherId, session.class_id);

    if (!classEntity) {
      throw new ClassServiceError('class not found', 404);
    }

    const enrollments = await this.attendanceWriter.findEnrollmentsAtSessionTime(
      command.teacherId,
      session.class_id,
      session.scheduled_at,
    );

    let attendanceCreated = 0;
    let feeRecordsSynced = 0;

    for (const enrollment of enrollments) {
      let attendance = await this.attendanceWriter.findAttendanceForStudent(
        command.teacherId,
        command.sessionId,
        enrollment.student_id,
      );

      if (!attendance) {
        attendance = this.attendanceWriter.create({
          teacher_id: command.teacherId,
          session_id: command.sessionId,
          student_id: enrollment.student_id,
          status: AttendanceStatus.AbsentUnexcused,
          source: AttendanceSource.System,
          overridden_at: null,
          notes: null,
        });
        attendance = await this.attendanceWriter.save(attendance);
        attendanceCreated += 1;
      }

      const shouldCharge = attendance.status === AttendanceStatus.Present
        || attendance.status === AttendanceStatus.AbsentUnexcused;

      await this.finance.syncAttendanceFeeRecord({
        teacherId: command.teacherId,
        sessionId: session.id,
        studentId: enrollment.student_id,
        enrollmentId: enrollment.id,
        amount: classEntity.fee_per_session,
        shouldCharge,
      });
      feeRecordsSynced += 1;
    }

    return {
      attendance_created: attendanceCreated,
      fee_records_synced: feeRecordsSynced,
    };
  }
}
