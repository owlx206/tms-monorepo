import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Link, useParams } from "react-router";

import { ApiError } from "../services/apiClient";
import {
  listSessionAttendance,
  type BackendAttendanceSource,
  type BackendAttendanceStatus,
  type SessionAttendanceRow,
  upsertAttendance,
} from "../services/attendanceService";
import {
  listClasses,
  type BackendClass,
  type BackendSession,
  type BackendSessionStatus,
} from "../services/classService";
import { formatVietnamDate, formatVietnamTime } from "../services/vietnamTime";

const ATTENDANCE_OPTIONS: Array<{ value: BackendAttendanceStatus; label: string }> = [
  { value: "present", label: "Có mặt" },
  { value: "absent_excused", label: "Vắng có lý do" },
  { value: "absent_unexcused", label: "Vắng không lý do" },
];

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Đã có lỗi xảy ra";
}

function formatTime(value: string): string {
  return formatVietnamTime(value);
}

function formatDate(value: string): string {
  return formatVietnamDate(value, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(value: string): string {
  return formatVietnamDate(value);
}

function statusBadgeClass(status: BackendSessionStatus): string {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "in_progress":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "scheduled":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "cancelled":
      return "bg-zinc-100 text-zinc-500 border-zinc-200";
    default:
      return "bg-zinc-100 text-zinc-600 border-zinc-200";
  }
}

function statusText(status: BackendSessionStatus): string {
  switch (status) {
    case "completed":
      return "Đã hoàn thành";
    case "in_progress":
      return "Đang diễn ra";
    case "cancelled":
      return "Đã hủy";
    case "scheduled":
      return "Sắp diễn ra";
    default:
      return status;
  }
}

function StatusIcon({ status }: { status: BackendSessionStatus }) {
  const iconClassName = "h-4 w-4";

  const icon =
    status === "completed" ? (
      <CheckCircle2 className={iconClassName} />
    ) : status === "cancelled" ? (
      <XCircle className={iconClassName} />
    ) : (
      <Clock className={iconClassName} />
    );

  return (
    <span
      aria-label={statusText(status)}
      title={statusText(status)}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${statusBadgeClass(status)}`}
    >
      {icon}
    </span>
  );
}

function sourceText(source: BackendAttendanceSource | null): string {
  if (source === "manual") {
    return "Thủ công";
  }

  if (source === "bot") {
    return "Bot";
  }

  if (source === "system") {
    return "Hệ thống";
  }

  return "-";
}

function getAttendanceStatus(status: BackendAttendanceStatus | null): BackendAttendanceStatus {
  return status ?? "absent_unexcused";
}

export function SessionDetail() {
  const params = useParams();
  const sessionId = Number(params.sessionId);

  const [classes, setClasses] = useState<BackendClass[]>([]);
  const [session, setSession] = useState<BackendSession | null>(null);
  const [attendance, setAttendance] = useState<SessionAttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStudentId, setSavingStudentId] = useState<number | null>(null);
  const [requestError, setRequestError] = useState("");

  const loadData = async (): Promise<void> => {
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      setRequestError("session_id không hợp lệ");
      setLoading(false);
      return;
    }

    setLoading(true);
    setRequestError("");

    try {
      const [classList, detail] = await Promise.all([
        listClasses(),
        listSessionAttendance(sessionId),
      ]);
      setClasses(classList);
      setSession(detail.session as unknown as BackendSession);
      setAttendance(detail.attendance);
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [sessionId]);

  const className = useMemo(() => {
    if (!session) {
      return "";
    }

    return classes.find((item) => item.id === session.class_id)?.name ?? `Lớp #${session.class_id}`;
  }, [classes, session]);

  const readonly = session?.status === "cancelled";

  const presentCount = useMemo(
    () => attendance.filter((row) => row.attendance_status === "present").length,
    [attendance],
  );

  const updateRow = async (
    row: SessionAttendanceRow,
    payload: { status?: BackendAttendanceStatus; notes?: string | null },
  ) => {
    if (!session || readonly) {
      return;
    }

    const nextStatus = payload.status ?? getAttendanceStatus(row.attendance_status);
    const nextNotes = payload.notes === undefined ? row.notes : payload.notes;

    setSavingStudentId(row.student_id);
    setRequestError("");

    try {
      await upsertAttendance(session.id, row.student_id, {
        status: nextStatus,
        notes: nextNotes,
      });
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSavingStudentId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
          <p className="text-zinc-600">Đang tải thông tin buổi học...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8">
        {requestError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {requestError}
          </div>
        )}
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center mb-6">
          <p className="text-zinc-600">Không tìm thấy buổi học.</p>
        </div>
        <Link
          to="/sessions"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách buổi học
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Back link */}
      <Link
        to="/sessions"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại danh sách buổi học
      </Link>

      {/* Session header */}
      <div className="mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="mb-2 flex flex-wrap items-center gap-3 text-3xl font-semibold text-zinc-900">
              <span>{className}</span>
              <StatusIcon status={session.status} />
            </h1>
            <p className="text-zinc-600">{formatDate(session.scheduled_at)}</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {requestError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {requestError}
        </div>
      )}

      {/* Session info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="h-5 w-5 text-zinc-400" />
            <span className="text-sm text-zinc-500">Ngày</span>
          </div>
          <p className="font-semibold text-zinc-900">{formatDateShort(session.scheduled_at)}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-5 w-5 text-zinc-400" />
            <span className="text-sm text-zinc-500">Giờ</span>
          </div>
          <p className="font-semibold text-zinc-900">{formatTime(session.scheduled_at)}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="h-5 w-5 text-zinc-400" />
            <span className="text-sm text-zinc-500">Trạng thái</span>
          </div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(session.status)}`}>
            {statusText(session.status)}
          </span>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="h-5 w-5 text-zinc-400" />
            <span className="text-sm text-zinc-500">Loại</span>
          </div>
          <p className="font-semibold text-zinc-900">
            {session.is_manual ? "Thủ công" : "Recurring"}
          </p>
        </div>
      </div>

      {/* Attendance section */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Điểm danh</h2>
          <p className="text-sm text-zinc-500">
            {presentCount}/{attendance.length} học sinh có mặt
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-600">
              <tr>
                <th className="px-5 py-3 font-medium">Học sinh</th>
                <th className="px-5 py-3 font-medium">Trạng thái</th>
                <th className="px-5 py-3 font-medium">Nguồn</th>
                <th className="px-5 py-3 font-medium">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {attendance.map((row) => {
                const saving = savingStudentId === row.student_id;
                return (
                  <tr key={row.student_id} className={readonly ? "bg-zinc-50" : "bg-white"}>
                    <td className="px-5 py-4 font-medium text-zinc-900">{row.student_name}</td>
                    <td className="px-5 py-4">
                      <select
                        value={getAttendanceStatus(row.attendance_status)}
                        disabled={readonly || saving}
                        onChange={(event) =>
                          void updateRow(row, {
                            status: event.target.value as BackendAttendanceStatus,
                          })
                        }
                        className="h-9 w-44 rounded-lg border border-zinc-200 bg-white px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-500"
                      >
                        {ATTENDANCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4 text-zinc-600">{sourceText(row.source)}</td>
                    <td className="px-5 py-4">
                      <input
                        type="text"
                        defaultValue={row.notes ?? ""}
                        disabled={readonly || saving}
                        onBlur={(event) => {
                          const nextNotes = event.target.value.trim() || null;
                          if (nextNotes !== (row.notes ?? null)) {
                            void updateRow(row, { notes: nextNotes });
                          }
                        }}
                        className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-500"
                        placeholder="Nhập ghi chú"
                      />
                    </td>
                  </tr>
                );
              })}
              {attendance.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-zinc-500">
                    Chưa có học sinh để điểm danh trong buổi này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {readonly && (
          <div className="flex items-center gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-3 text-sm text-zinc-600">
            <XCircle className="h-4 w-4" />
            Buổi học đã huỷ, bảng điểm danh chỉ đọc.
          </div>
        )}
      </div>
    </div>
  );
}
