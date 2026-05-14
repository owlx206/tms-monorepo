import { AttendanceSource, AttendanceStatus } from '../../../../entities/enums.js';
import { ClassServiceError } from '../../../../shared/errors/class.error.js';
import type { AttendanceRecordSummary } from '../dto/AttendanceDto.js';
import type { TypeOrmSessionFinanceService } from '../../infrastructure/persistence/typeorm/TypeOrmSessionFinanceService.js';
import type { AttendanceRepository } from '../../infrastructure/persistence/typeorm/AttendanceRepository.js';
import { AttendanceMapper } from '../../infrastructure/persistence/typeorm/AttendanceMapper.js';

type UpsertBotSessionAttendanceCommand = {
  teacherId: number;
  sessionId: number;
  studentId: number;
};

export class UpsertBotSessionAttendanceUseCase {
  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly finance: TypeOrmSessionFinanceService,
  ) {}

  async execute(command: UpsertBotSessionAttendanceCommand): Promise<AttendanceRecordSummary | null> {
    const session = await this.attendanceRepository.findSessionById(command.teacherId, command.sessionId);

    if (!session) {
      throw new ClassServiceError('session not found', 404);
    }

    const classEntity = await this.attendanceRepository.findClassById(command.teacherId, session.class_id);

    if (!classEntity) {
      throw new ClassServiceError('class not found', 404);
    }

    const student = await this.attendanceRepository.findStudentById(command.teacherId, command.studentId);

    if (!student) {
      throw new ClassServiceError('student not found', 404);
    }

    const enrollment = await this.attendanceRepository.findEnrollmentAtSessionTime(
      command.teacherId,
      command.studentId,
      session.class_id,
      session.scheduled_at,
    );

    if (!enrollment) {
      throw new ClassServiceError('student is not enrolled in class at this session', 409);
    }

    if (session.isCancelled()) {
      throw new ClassServiceError('cannot update attendance for a cancelled session', 409);
    }

    let attendance = await this.attendanceRepository.findAttendanceForStudent(
      command.teacherId,
      command.sessionId,
      command.studentId,
    );

    if (attendance?.source === AttendanceSource.Manual) {
      return null;
    }

    if (attendance?.status === AttendanceStatus.AbsentExcused) {
      return null;
    }

    if (
      attendance?.source === AttendanceSource.Bot
      && attendance.status === AttendanceStatus.Present
    ) {
      return AttendanceMapper.toSummary(attendance);
    }

    if (!attendance) {
      attendance = this.attendanceRepository.create({
        teacher_id: command.teacherId,
        session_id: command.sessionId,
        student_id: command.studentId,
        status: AttendanceStatus.Present,
        source: AttendanceSource.Bot,
        overridden_at: null,
        notes: null,
      });
    } else {
      attendance.status = AttendanceStatus.Present;
      attendance.source = AttendanceSource.Bot;
      attendance.overridden_at = null;
    }

    const saved = await this.attendanceRepository.save(attendance);

    await this.finance.syncAttendanceFeeRecord({
      teacherId: command.teacherId,
      sessionId: session.id,
      studentId: command.studentId,
      enrollmentId: enrollment.id,
      amount: classEntity.fee_per_session,
      shouldCharge: true,
    });

    return AttendanceMapper.toSummary(saved);
  }
}
