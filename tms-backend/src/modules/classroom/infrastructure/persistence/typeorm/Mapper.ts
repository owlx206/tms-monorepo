import { type AttendanceRecordSummary, type ClassScheduleSummary, type SessionSummary } from '../../../contracts/types.js';
import { type Attendance } from './entities/attendance.entity.js';
import { type ClassSchedule } from './entities/class-schedule.entity.js';
import { type Session } from './entities/session.entity.js';

// AttendanceMapper.ts
export class AttendanceMapper {
  static toSummary(attendance: Attendance): AttendanceRecordSummary {
    return {
      id: attendance.id,
      teacher_id: attendance.teacher_id,
      session_id: attendance.session_id,
      student_id: attendance.student_id,
      status: attendance.status,
      source: attendance.source,
      overridden_at: attendance.overridden_at,
      notes: attendance.notes,
    };
  }
}

// ClassScheduleMapper.ts
export class ClassScheduleMapper {
  static toSummary(schedule: ClassSchedule): ClassScheduleSummary {
    return {
      id: schedule.id,
      teacher_id: schedule.teacher_id,
      class_id: schedule.class_id,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
    };
  }
}

// SessionMapper.ts
export class SessionMapper {
  static toSummary(session: Session): SessionSummary {
    return {
      id: session.id,
      teacher_id: session.teacher_id,
      class_id: session.class_id,
      scheduled_at: session.scheduled_at,
      end_time: session.end_time,
      status: session.status,
      is_manual: session.is_manual,
      created_at: session.created_at,
      cancelled_at: session.cancelled_at,
    };
  }
}

// ClassroomDateTime.ts
export function dateOnlyToDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function combineDateAndTime(dateOnly: string, timeValue: string): Date {
  const date = dateOnlyToDate(dateOnly);
  const [hours, minutes, seconds] = timeValue.split(':').map(Number);

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    seconds,
    0,
  );
}
