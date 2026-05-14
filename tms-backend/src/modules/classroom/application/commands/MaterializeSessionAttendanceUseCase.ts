import { AttendanceSource, AttendanceStatus } from '../../../../entities/enums.js';
import { ClassServiceError } from '../../../../shared/errors/class.error.js';
import type { TypeOrmSessionFinanceService } from '../../infrastructure/persistence/typeorm/TypeOrmSessionFinanceService.js';
import type { AttendanceRepository } from '../../infrastructure/persistence/typeorm/AttendanceRepository.js';

type MaterializeSessionAttendanceCommand = {
  teacherId: number;
  sessionId: number;
};

export class MaterializeSessionAttendanceUseCase {
  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly finance: TypeOrmSessionFinanceService,
  ) {}

  async execute(command: MaterializeSessionAttendanceCommand): Promise<{
    attendance_created: number;
    fee_records_synced: number;
  }> {
    const session = await this.attendanceRepository.findSessionById(command.teacherId, command.sessionId);

    if (!session) {
      throw new ClassServiceError('session not found', 404);
    }

    if (session.isCancelled()) {
      return {
        attendance_created: 0,
        fee_records_synced: 0,
      };
    }

    const classEntity = await this.attendanceRepository.findClassById(command.teacherId, session.class_id);

    if (!classEntity) {
      throw new ClassServiceError('class not found', 404);
    }

    const enrollments = await this.attendanceRepository.findEnrollmentsAtSessionTime(
      command.teacherId,
      session.class_id,
      session.scheduled_at,
    );

    let attendanceCreated = 0;
    let feeRecordsSynced = 0;

    for (const enrollment of enrollments) {
      let attendance = await this.attendanceRepository.findAttendanceForStudent(
        command.teacherId,
        command.sessionId,
        enrollment.student_id,
      );

      if (!attendance) {
        attendance = this.attendanceRepository.create({
          teacher_id: command.teacherId,
          session_id: command.sessionId,
          student_id: enrollment.student_id,
          status: AttendanceStatus.AbsentUnexcused,
          source: AttendanceSource.System,
          overridden_at: null,
          notes: null,
        });
        attendance = await this.attendanceRepository.save(attendance);
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
