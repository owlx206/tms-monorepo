import type { DataSource } from 'typeorm';

export async function installDatabaseIntegrityRules(dataSource: DataSource): Promise<void> {
  // Student identities are scoped by teacher. The old global unique index on
  // codeforces_handle incorrectly prevented the same handle from existing under
  // different teachers.
  await dataSource.query(`
    DROP INDEX IF EXISTS uq_students_codeforces_handle
  `);

  await dataSource.query(`
    DROP INDEX IF EXISTS uq_students_teacher_codeforces_handle
  `);

  await dataSource.query(`
    CREATE UNIQUE INDEX uq_students_teacher_codeforces_handle
    ON students (teacher_id, LOWER(codeforces_handle))
    WHERE codeforces_handle IS NOT NULL
  `);

  await dataSource.query(`
    ALTER TABLE attendance
    DROP CONSTRAINT IF EXISTS chk_attendance_override
  `);

  await dataSource.query(`
    ALTER TABLE attendance
    ADD CONSTRAINT chk_attendance_override
    CHECK (
      (source = 'manual' AND overridden_at IS NOT NULL)
      OR (source IN ('bot', 'system') AND overridden_at IS NULL)
    )
  `);

  await dataSource.query(`
    ALTER TABLE attendance
    ALTER COLUMN source SET DEFAULT 'system'::attendance_source
  `);

  // ── R7: Refund balance — total refunds must not exceed total payments per (teacher, student) ──
  await dataSource.query(`
    CREATE OR REPLACE FUNCTION enforce_transaction_refund_balance()
    RETURNS trigger AS $$
    DECLARE
      total_payments numeric;
      total_refunds numeric;
    BEGIN
      IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM pg_advisory_xact_lock(NEW.teacher_id, NEW.student_id);

        SELECT
          COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN type = 'refund' THEN ABS(amount) ELSE 0 END), 0)
        INTO total_payments, total_refunds
        FROM transactions
        WHERE teacher_id = NEW.teacher_id
          AND student_id = NEW.student_id;

        IF total_refunds > total_payments THEN
          RAISE EXCEPTION 'Tổng số tiền hoàn trả không được lớn hơn tổng số tiền đã nhận'
            USING ERRCODE = '23514',
              CONSTRAINT = 'chk_transactions_refund_not_over_payment';
        END IF;
      END IF;

      IF TG_OP = 'DELETE'
        OR (
          TG_OP = 'UPDATE'
          AND (OLD.teacher_id <> NEW.teacher_id OR OLD.student_id <> NEW.student_id)
        )
      THEN
        PERFORM pg_advisory_xact_lock(OLD.teacher_id, OLD.student_id);

        SELECT
          COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN type = 'refund' THEN ABS(amount) ELSE 0 END), 0)
        INTO total_payments, total_refunds
        FROM transactions
        WHERE teacher_id = OLD.teacher_id
          AND student_id = OLD.student_id;

        IF total_refunds > total_payments THEN
          RAISE EXCEPTION 'Tổng số tiền hoàn trả không được lớn hơn tổng số tiền đã nhận'
            USING ERRCODE = '23514',
              CONSTRAINT = 'chk_transactions_refund_not_over_payment';
        END IF;
      END IF;

      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await dataSource.query('DROP TRIGGER IF EXISTS trg_transactions_refund_balance ON transactions');

  await dataSource.query(`
    CREATE CONSTRAINT TRIGGER trg_transactions_refund_balance
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    DEFERRABLE INITIALLY IMMEDIATE
    FOR EACH ROW
    EXECUTE FUNCTION enforce_transaction_refund_balance();
  `);

  // ── Unique sessions: no duplicate (teacher, class, scheduled_at) for non-cancelled sessions ──
  await dataSource.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_no_duplicate
    ON sessions (teacher_id, class_id, scheduled_at)
    WHERE status <> 'cancelled';
  `);

  // ── R1: Active students must have at least one active enrollment ──
  await dataSource.query(`
    CREATE OR REPLACE FUNCTION enforce_active_student_has_enrollment()
    RETURNS trigger AS $$
    DECLARE
      enrollment_count integer;
    BEGIN
      IF NEW.status = 'active' THEN
        SELECT COUNT(*) INTO enrollment_count
        FROM enrollments
        WHERE teacher_id = NEW.teacher_id
          AND student_id = NEW.id
          AND unenrolled_at IS NULL;

        IF enrollment_count = 0 THEN
          RAISE EXCEPTION 'Học sinh đang học phải có ít nhất một lớp đang enroll'
            USING ERRCODE = '23514',
              CONSTRAINT = 'chk_active_student_must_have_class';
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await dataSource.query('DROP TRIGGER IF EXISTS trg_active_student_has_enrollment ON students');

  await dataSource.query(`
    CREATE CONSTRAINT TRIGGER trg_active_student_has_enrollment
    AFTER INSERT OR UPDATE OF status ON students
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION enforce_active_student_has_enrollment();
  `);

  // ── R3: Enrollments cannot be active (unenrolled_at IS NULL) if the class is archived ──
  await dataSource.query(`
    CREATE OR REPLACE FUNCTION enforce_no_active_enrollment_in_archived_class()
    RETURNS trigger AS $$
    DECLARE
      class_status text;
    BEGIN
      IF NEW.unenrolled_at IS NULL THEN
        SELECT status INTO class_status
        FROM classes
        WHERE id = NEW.class_id;

        IF class_status = 'archived' THEN
          RAISE EXCEPTION 'Không thể tạo enrollment trong lớp đã đóng'
            USING ERRCODE = '23514',
              CONSTRAINT = 'chk_enrollment_class_must_be_active';
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await dataSource.query('DROP TRIGGER IF EXISTS trg_no_active_enrollment_in_archived_class ON enrollments');

  await dataSource.query(`
    CREATE CONSTRAINT TRIGGER trg_no_active_enrollment_in_archived_class
    AFTER INSERT OR UPDATE ON enrollments
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION enforce_no_active_enrollment_in_archived_class();
  `);

  // ── R5: Topics must be closed (expires_at IS NOT NULL) when their class is archived ──
  await dataSource.query(`
    CREATE OR REPLACE FUNCTION enforce_archive_class_closes_topics()
    RETURNS trigger AS $$
    DECLARE
      open_topic_count integer;
    BEGIN
      IF NEW.status = 'archived' THEN
        SELECT COUNT(*) INTO open_topic_count
        FROM topics
        WHERE class_id = NEW.id
          AND teacher_id = NEW.teacher_id
          AND expires_at IS NULL;

        IF open_topic_count > 0 THEN
          RAISE EXCEPTION 'Không thể đóng lớp khi còn % chuyên đề chưa đóng', open_topic_count
            USING ERRCODE = '23514',
              CONSTRAINT = 'chk_archived_class_no_open_topics';
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await dataSource.query('DROP TRIGGER IF EXISTS trg_archive_class_closes_topics ON classes');

  await dataSource.query(`
    CREATE CONSTRAINT TRIGGER trg_archive_class_closes_topics
    AFTER UPDATE OF status ON classes
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION enforce_archive_class_closes_topics();
  `);

  // ── R12: Class schedules must not exist for archived classes ──
  await dataSource.query(`
    CREATE OR REPLACE FUNCTION enforce_no_schedule_on_archived_class()
    RETURNS trigger AS $$
    DECLARE
      class_status text;
    BEGIN
      SELECT status INTO class_status
      FROM classes
      WHERE id = NEW.class_id;

      IF class_status = 'archived' THEN
        RAISE EXCEPTION 'Không thể tạo lịch học cho lớp đã đóng'
          USING ERRCODE = '23514',
          CONSTRAINT = 'chk_schedule_class_must_be_active';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await dataSource.query('DROP TRIGGER IF EXISTS trg_no_schedule_on_archived_class ON class_schedules');

  await dataSource.query(`
    CREATE CONSTRAINT TRIGGER trg_no_schedule_on_archived_class
    AFTER INSERT OR UPDATE ON class_schedules
    DEFERRABLE INITIALLY IMMEDIATE
    FOR EACH ROW
    EXECUTE FUNCTION enforce_no_schedule_on_archived_class();
  `);

  // ── R13: Class schedules for active classes cannot overlap per teacher/day.
  // Uses [start_time, end_time), so touching boundaries are allowed.
  await dataSource.query(`
    CREATE OR REPLACE FUNCTION enforce_class_schedule_no_overlap()
    RETURNS trigger AS $$
    DECLARE
      overlapping_class_name text;
    BEGIN
      PERFORM pg_advisory_xact_lock(NEW.teacher_id, NEW.day_of_week);

      SELECT class.name INTO overlapping_class_name
      FROM class_schedules AS schedule
      INNER JOIN classes AS class
        ON class.id = schedule.class_id
      WHERE schedule.teacher_id = NEW.teacher_id
        AND schedule.day_of_week = NEW.day_of_week
        AND schedule.id <> NEW.id
        AND class.status = 'active'::class_status
        AND schedule.start_time < NEW.end_time
        AND NEW.start_time < schedule.end_time
      LIMIT 1;

      IF overlapping_class_name IS NOT NULL THEN
        RAISE EXCEPTION 'Lịch học bị trùng với lớp %', overlapping_class_name
          USING ERRCODE = '23514',
            CONSTRAINT = 'chk_class_schedules_no_overlap';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await dataSource.query('DROP TRIGGER IF EXISTS trg_class_schedule_no_overlap ON class_schedules');

  await dataSource.query(`
    CREATE CONSTRAINT TRIGGER trg_class_schedule_no_overlap
    AFTER INSERT OR UPDATE ON class_schedules
    DEFERRABLE INITIALLY IMMEDIATE
    FOR EACH ROW
    EXECUTE FUNCTION enforce_class_schedule_no_overlap();
  `);

  // ── R14: Non-cancelled sessions cannot overlap per teacher/date.
  // Uses [scheduled_at, end_at), so touching boundaries are allowed.
  await dataSource.query(`
    CREATE OR REPLACE FUNCTION enforce_session_no_overlap()
    RETURNS trigger AS $$
    DECLARE
      overlapping_class_name text;
    BEGIN
      IF NEW.status = 'cancelled'::session_status THEN
        RETURN NEW;
      END IF;

      IF NEW.end_time IS NULL THEN
        RAISE EXCEPTION 'Buổi học chưa huỷ phải có giờ kết thúc'
          USING ERRCODE = '23514',
            CONSTRAINT = 'chk_sessions_end_time_required';
      END IF;

      IF NEW.end_time <= NEW.scheduled_at::time THEN
        RAISE EXCEPTION 'Giờ kết thúc buổi học phải lớn hơn giờ bắt đầu'
          USING ERRCODE = '23514',
            CONSTRAINT = 'chk_sessions_time_range';
      END IF;

      PERFORM pg_advisory_xact_lock(NEW.teacher_id, hashtext((NEW.scheduled_at::date)::text));

      SELECT class.name INTO overlapping_class_name
      FROM sessions AS session
      INNER JOIN classes AS class
        ON class.id = session.class_id
      WHERE session.teacher_id = NEW.teacher_id
        AND session.id <> NEW.id
        AND session.status <> 'cancelled'::session_status
        AND session.end_time IS NOT NULL
        AND session.scheduled_at::date = NEW.scheduled_at::date
        AND session.scheduled_at < (NEW.scheduled_at::date + NEW.end_time)::timestamptz
        AND NEW.scheduled_at < (session.scheduled_at::date + session.end_time)::timestamptz
      LIMIT 1;

      IF overlapping_class_name IS NOT NULL THEN
        RAISE EXCEPTION 'Buổi học bị trùng với lớp %', overlapping_class_name
          USING ERRCODE = '23514',
            CONSTRAINT = 'chk_sessions_no_overlap';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await dataSource.query('DROP TRIGGER IF EXISTS trg_session_no_overlap ON sessions');

  await dataSource.query(`
    CREATE CONSTRAINT TRIGGER trg_session_no_overlap
    AFTER INSERT OR UPDATE OF teacher_id, class_id, scheduled_at, end_time, status ON sessions
    DEFERRABLE INITIALLY IMMEDIATE
    FOR EACH ROW
    EXECUTE FUNCTION enforce_session_no_overlap();
  `);

  // ── R4: Fee records must be cancelled when their session is cancelled ──
  await dataSource.query(`
    CREATE OR REPLACE FUNCTION enforce_cancel_fees_on_session_cancel()
    RETURNS trigger AS $$
    DECLARE
      active_fee_count integer;
    BEGIN
      IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status <> 'cancelled') THEN
        SELECT COUNT(*) INTO active_fee_count
        FROM fee_records
        WHERE session_id = NEW.id
          AND status = 'active';

        IF active_fee_count > 0 THEN
          RAISE EXCEPTION 'Không thể huỷ buổi học khi còn % fee_record active chưa huỷ', active_fee_count
            USING ERRCODE = '23514',
              CONSTRAINT = 'chk_cancelled_session_no_active_fees';
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await dataSource.query('DROP TRIGGER IF EXISTS trg_cancel_fees_on_session_cancel ON sessions');

  await dataSource.query(`
    CREATE CONSTRAINT TRIGGER trg_cancel_fees_on_session_cancel
    AFTER UPDATE OF status ON sessions
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION enforce_cancel_fees_on_session_cancel();
  `);
}
