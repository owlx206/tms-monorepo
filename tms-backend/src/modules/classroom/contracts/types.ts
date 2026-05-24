import type { StudentStatus } from '../../student/contracts/types.js';

export type GymStatusFilter = 'active';

export type GymListQuery = {
  class_id?: number | null;
  status?: GymStatusFilter;
};

export type BindClassGymInput = {
  gym_id: string;
  pull_interval_minutes?: number;
};

export type GymSummarySource = {
  closed_at: Date | null;
};

export type ListGymsReader<TGym extends GymSummarySource = GymSummarySource> = {
  listGymsForTeacher(teacherId: number, filters: { class_id?: number | null }): Promise<TGym[]>;
};

export type GymStandingMatrixGym = {
  id: number;
  class_id: number | null;
};

export type GymStandingMatrixProblem = {
  id: number;
  problem_index: string;
  problem_name: string | null;
};

export type GymStandingMatrixEnrollment = {
  student_id: number;
};

export type GymStandingMatrixStudent = {
  id: number;
  full_name: string;
};

export type GymStandingMatrixStanding = {
  student_id: number;
  problem_id: number;
  solved: boolean;
  penalty_minutes: number | null;
  pulled_at: Date | null;
};

export type GymStandingMatrixReader<
  TGym extends GymStandingMatrixGym = GymStandingMatrixGym,
  TProblem extends GymStandingMatrixProblem = GymStandingMatrixProblem,
  TEnrollment extends GymStandingMatrixEnrollment = GymStandingMatrixEnrollment,
  TStudent extends GymStandingMatrixStudent = GymStandingMatrixStudent,
  TStanding extends GymStandingMatrixStanding = GymStandingMatrixStanding,
> = {
  findOwnedClassGym(teacherId: number, classId: number, gymId: number): Promise<TGym | null>;
  listGymProblems(teacherId: number, gymId: number): Promise<TProblem[]>;
  listActiveEnrollmentsForClass(teacherId: number, classId: number): Promise<TEnrollment[]>;
  findStudentsByIds(teacherId: number, studentIds: number[]): Promise<TStudent[]>;
  listGymStandings(teacherId: number, gymId: number): Promise<TStanding[]>;
};

export enum AttendanceSource {
  Bot = 'bot',
  Manual = 'manual',
  System = 'system',
}

export enum AttendanceStatus {
  Present = 'present',
  AbsentExcused = 'absent_excused',
  AbsentUnexcused = 'absent_unexcused',
}

export enum ClassStatus {
  Active = 'active',
  Archived = 'archived',
}

export enum SessionStatus {
  Scheduled = 'scheduled',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export type ClassScheduleInput = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type CreateClassInput = {
  name: string;
  fee_per_session: string;
  schedules: ClassScheduleInput[];
};

export type UpdateClassInput = {
  name?: string;
  fee_per_session?: string;
  schedules?: ClassScheduleInput[];
};

export type SelectClassDiscordGuildInput = {
  guild_id: number;
  notification_channel_id?: string | null;
  attendance_voice_channel_id?: string | null;
};

export type ChannelPostInput = {
  content: string;
  guild_ids: number[];
};

export type ClassListFilters = {
  status?: ClassStatus;
  ready_only?: boolean;
};

export type SessionListFilters = {
  class_id?: number;
  status?: SessionStatus;
  from?: Date;
  to?: Date;
};

export type CreateManualSessionInput = {
  scheduled_at: Date;
  end_time: string;
};

export type ClassSummary = {
  id: number;
  teacher_id: number;
  name: string;
  fee_per_session: string;
  status: ClassStatus;
  created_at: Date;
  archived_at: Date | null;
};

export type ClassSummaryWithSchedules = ClassSummary & {
  schedules: ClassScheduleSummary[];
};

export type ClassScheduleSummary = {
  id: number;
  teacher_id: number;
  class_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type ClassDiscordGuildSummary = {
  id: number;
  teacher_id: number;
  class_id: number;
  discord_guild_id: string;
  name: string | null;
  attendance_voice_channel_id: string | null;
  notification_channel_id: string | null;
};

export type TeacherDiscordGuildOption = {
  id: number;
  teacher_id: number;
  discord_guild_id: string;
  name: string | null;
  synced_at: Date | null;
  binding: {
    role: 'unbound' | 'class';
    guild_binding_id: number | null;
    class_id: number | null;
    class_name: string | null;
    notification_channel_id: string | null;
    notification_channel_name: string | null;
    notification_channel_cache_id: number | null;
    attendance_voice_channel_id: string | null;
    attendance_voice_channel_name: string | null;
    attendance_voice_channel_cache_id: number | null;
  };
};

export type TeacherDiscordChannelOption = {
  id: number;
  teacher_id: number;
  discord_guild_id: string;
  discord_channel_id: string;
  name: string;
  type: 'text' | 'voice';
  synced_at: Date;
};

export type ClassDetailStudentSummary = {
  id: number;
  teacher_id: number;
  full_name: string;
  codeforces_handle: string | null;
  discord_username: string | null;
  discord_user_id: string | null;
  phone: string | null;
  status: StudentStatus;
  enrolled_at: Date;
};

export type ClassDetails = {
  class: ClassSummary;
  schedules: ClassScheduleSummary[];
  discord_guild: ClassDiscordGuildSummary | null;
  active_students: ClassDetailStudentSummary[];
  topics: Array<{
    id: number;
    teacher_id: number;
    class_id: number;
    title: string;
    gym_link: string;
    gym_id: string | null;
    closed_at: Date | null;
    pull_interval_minutes: number;
    last_pulled_at: Date | null;
    created_at: Date;
    status: GymStatusFilter;
    problems: Array<{
      id: number;
      teacher_id: number;
      topic_id: number;
      problem_index: string;
      problem_name: string | null;
    }>;
    progress: {
      total_students: number;
      total_problems: number;
      solved_count: number;
      completed_students: number;
      average_solved: number;
    };
  }>;
  is_ready: boolean;
};

export type SessionSummary = {
  id: number;
  teacher_id: number;
  class_id: number;
  scheduled_at: Date;
  end_time: string | null;
  status: SessionStatus;
  is_manual: boolean;
  created_at: Date;
  cancelled_at: Date | null;
};

export type AttendanceListFilters = {
  session_id?: number;
  student_id?: number;
  status?: AttendanceStatus;
};

export type SessionAttendanceRow = {
  student_id: number;
  student_name: string;
  student_status: StudentStatus;
  attendance_id: number | null;
  attendance_status: AttendanceStatus | null;
  source: AttendanceSource | null;
  notes: string | null;
  overridden_at: Date | null;
};

export type SessionAttendanceSummary = {
  session: SessionSummary;
  attendance: SessionAttendanceRow[];
};

export type AttendanceRecordSummary = {
  id: number;
  teacher_id: number;
  session_id: number;
  student_id: number;
  status: AttendanceStatus;
  source: AttendanceSource;
  overridden_at: Date | null;
  notes: string | null;
};

export type UpsertSessionAttendanceInput = {
  status: AttendanceStatus;
  notes?: string | null;
};

export type CreateClassCommand = {
  teacherId: number;
  name: string;
  feePerSession: string;
  schedules: CreateClassInput['schedules'];
};

export type UpdateClassCommand = {
  teacherId: number;
  classId: number;
  name?: string;
  feePerSession?: string;
  schedules?: UpdateClassInput['schedules'];
};

export type ClassSessionLifecycle = {
  deleteAutoGeneratedSessions(teacherId: number, classId: number): Promise<number>;
};

export type ArchiveClassCommand = {
  teacherId: number;
  classId: number;
  archivedAt: Date;
};

export type CancelSessionCommand = {
  teacherId: number;
  sessionId: number;
  cancelledAt: Date;
};

export type CreateManualSessionCommand = {
  teacherId: number;
  classId: number;
  session: CreateManualSessionInput;
};

export type UpsertSessionAttendanceCommand = {
  teacherId: number;
  sessionId: number;
  studentId: number;
  attendance: UpsertSessionAttendanceInput;
};
