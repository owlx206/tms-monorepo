import type { ClassStatus, SessionStatus } from '../../../../entities/enums.js';

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

export type ClassScheduleSummary = {
  id: number;
  teacher_id: number;
  class_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type ClassDiscordServerSummary = {
  id: number;
  teacher_id: number;
  class_id: number;
  discord_server_id: string;
  name: string | null;
  attendance_voice_channel_id: string | null;
  notification_channel_id: string | null;
};

export type ClassDetailStudentSummary = {
  id: number;
  teacher_id: number;
  full_name: string;
  codeforces_handle: string | null;
  discord_username: string | null;
  discord_user_id: string | null;
  phone: string | null;
  status: string;
  enrolled_at: Date;
};

export type ClassDetails = {
  class: ClassSummary;
  schedules: ClassScheduleSummary[];
  discord_server: ClassDiscordServerSummary | null;
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
    status: 'active' | 'closed';
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
