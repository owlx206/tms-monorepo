import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Calendar, Plus, Trash2 } from "lucide-react";

import { ApiError } from "../services/apiClient";
import {
  BackendClass,
  BackendSession,
  cancelSession,
  createManualSession,
  listClasses,
  listSessions,
} from "../services/classService";
import {
  addDaysToDateOnly,
  formatVietnamDate,
  formatVietnamTime,
  todayVietnamDateOnly,
  vietnamDateRangeToIso,
} from "../services/vietnamTime";

type SessionStatusFilter = 'all' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

type SessionCard = {
  id: number;
  classId: number;
  className: string;
  dateLabel: string;
  timeLabel: string;
  status: BackendSession['status'];
  isRecurring: boolean;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Đã có lỗi xảy ra";
}

function formatSessionDate(date: Date): string {
  return formatVietnamDate(date);
}

function formatSessionTime(date: Date): string {
  return formatVietnamTime(date);
}

function toSessionCards(sessions: BackendSession[], classes: BackendClass[]): SessionCard[] {
  const classNameById = new Map<number, string>(classes.map((classItem) => [classItem.id, classItem.name]));

  return sessions.map((session) => {
    const scheduledAt = new Date(session.scheduled_at);

    return {
      id: session.id,
      classId: session.class_id,
      className: classNameById.get(session.class_id) ?? `Lớp #${session.class_id}`,
      dateLabel: Number.isNaN(scheduledAt.getTime()) ? session.scheduled_at : formatSessionDate(scheduledAt),
      timeLabel: Number.isNaN(scheduledAt.getTime())
        ? "--:--"
        : `${formatSessionTime(scheduledAt)}${session.end_time ? `-${session.end_time.slice(0, 5)}` : ""}`,
      status: session.status,
      isRecurring: !session.is_manual,
    };
  });
}

export function Sessions() {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<SessionStatusFilter>('all');
  const [sessionDate, setSessionDate] = useState("");
  const [classes, setClasses] = useState<BackendClass[]>([]);
  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [requestError, setRequestError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);

  const rangeToggleVisible = filterStatus === 'all' || filterStatus === 'scheduled' || filterStatus === 'in_progress';

  const loadData = useCallback(async (): Promise<void> => {
    setRequestError("");

    try {
      const dateFilters: { from?: string; to?: string } = {};
      if (sessionDate) {
        Object.assign(dateFilters, vietnamDateRangeToIso(sessionDate));
      } else if (rangeToggleVisible && !showAllSessions) {
        const today = todayVietnamDateOnly();
        dateFilters.from = vietnamDateRangeToIso(today).from;
        dateFilters.to = vietnamDateRangeToIso(addDaysToDateOnly(today, 7)).to;
      }

      const [classList, sessionList] = await Promise.all([
        listClasses(),
        listSessions({
          ...dateFilters,
          status: filterStatus === 'all' ? undefined : filterStatus,
        }),
      ]);

      setClasses(classList);
      setSessions(toSessionCards(sessionList, classList));
    } catch (error) {
      setRequestError(toErrorMessage(error));
    }
  }, [filterStatus, rangeToggleVisible, sessionDate, showAllSessions]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredSessions = useMemo(
    () => (filterStatus === 'all' ? sessions : sessions.filter((session) => session.status === filterStatus)),
    [sessions, filterStatus],
  );

  const activeClasses = useMemo(
    () => classes.filter((classItem) => classItem.status === 'active'),
    [classes],
  );

  const getStatusBadge = (status: BackendSession['status']) => {
    switch (status) {
      case 'scheduled':
        return <span className="px-3 py-1 bg-zinc-900 text-white rounded-full text-sm">Sắp diễn ra</span>;
      case 'in_progress':
        return <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm">Đang diễn ra</span>;
      case 'completed':
        return <span className="px-3 py-1 bg-zinc-200 text-zinc-700 rounded-full text-sm">Đã hoàn thành</span>;
      case 'cancelled':
        return <span className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-sm">Đã hủy</span>;
      default:
        return null;
    }
  };

  const handleAddSession = async (payload: { classId: number; date: string; time: string; endTime: string }) => {
    setSubmitting(true);
    setRequestError("");

    try {
      await createManualSession(payload.classId, {
        scheduled_date: payload.date,
        start_time: payload.time,
        end_time: payload.endTime,
      });

      setShowAddModal(false);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSession = async (sessionId: number) => {
    setSubmitting(true);
    setRequestError("");

    try {
      await cancelSession(sessionId);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 mb-2">Buổi học</h1>
          <p className="text-zinc-600">
            {sessionDate
              ? `Buổi học ngày ${formatVietnamDate(vietnamDateRangeToIso(sessionDate).from)}`
              : filterStatus === 'completed'
              ? "Tất cả buổi học đã hoàn thành"
              : filterStatus === 'cancelled'
                ? "Tất cả buổi học đã hủy"
                : showAllSessions
                  ? "Tất cả buổi học"
                  : "Buổi học trong 7 ngày tới"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {rangeToggleVisible && !sessionDate && (
            <button
              onClick={() => setShowAllSessions(!showAllSessions)}
              className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                showAllSessions
                  ? "bg-zinc-200 text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {showAllSessions ? "7 ngày tới" : "Xem tất cả"}
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-3 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Thêm buổi học
          </button>
        </div>
      </div>

      {requestError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {requestError}
        </div>
      )}

      <div className="mb-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(['all', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                  filterStatus === status
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {status === 'all'
                  ? 'Tất cả'
                  : status === 'scheduled'
                    ? 'Sắp diễn ra'
                    : status === 'in_progress'
                      ? 'Đang diễn ra'
                      : status === 'completed'
                        ? 'Đã hoàn thành'
                        : 'Đã hủy'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="session-date-filter" className="text-sm font-medium text-zinc-600">
              Ngày học
            </label>
            <input
              id="session-date-filter"
              type="date"
              value={sessionDate}
              onChange={(event) => setSessionDate(event.target.value)}
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400"
            />
            {sessionDate && (
              <button
                type="button"
                onClick={() => setSessionDate("")}
                className="h-10 rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
              >
                Xóa lọc
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSessions.map((session) => (
          <div
            key={session.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/sessions/${session.id}`)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/sessions/${session.id}`); } }}
            className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm cursor-pointer transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-zinc-600" />
                <div>
                  <h3 className="font-semibold text-zinc-900">{session.className}</h3>
                  {session.isRecurring && (
                    <span className="text-xs text-zinc-500">Auto-generated</span>
                  )}
                </div>
              </div>
              {getStatusBadge(session.status)}
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600">Ngày</span>
                <span className="text-zinc-900 font-medium">{session.dateLabel}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600">Giờ</span>
                <span className="text-zinc-900 font-medium">{session.timeLabel}</span>
              </div>
            </div>

            {(session.status === 'scheduled' || session.status === 'in_progress') && (
              <button
                className="w-full px-4 py-2 bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-60"
                onClick={(e) => { e.stopPropagation(); void handleCancelSession(session.id); }}
                disabled={submitting}
              >
                <Trash2 className="w-4 h-4" />
                Hủy buổi học
              </button>
            )}
          </div>
        ))}
      </div>

      {filteredSessions.length === 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <p className="text-zinc-600">Không có buổi học nào</p>
        </div>
      )}

      {showAddModal && (
        <AddSessionModal
          classes={activeClasses}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSession}
          submitting={submitting}
          error={requestError}
        />
      )}
    </div>
  );
}

function AddSessionModal({
  classes,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  classes: BackendClass[];
  onClose: () => void;
  onSubmit: (payload: { classId: number; date: string; time: string; endTime: string }) => Promise<void>;
  submitting: boolean;
  error: string;
}) {
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError("");

    const parsedClassId = Number(classId);

    if (!Number.isInteger(parsedClassId) || parsedClassId <= 0) {
      setLocalError("Vui lòng chọn lớp hợp lệ");
      return;
    }

    if (!date) {
      setLocalError("Vui lòng chọn ngày học");
      return;
    }

    if (!time) {
      setLocalError("Vui lòng chọn giờ bắt đầu");
      return;
    }

    if (!endTime) {
      setLocalError("Vui lòng chọn giờ kết thúc");
      return;
    }

    if (endTime <= time) {
      setLocalError("Giờ kết thúc phải lớn hơn giờ bắt đầu");
      return;
    }

    await onSubmit({
      classId: parsedClassId,
      date,
      time,
      endTime,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-zinc-200 rounded-xl p-6 w-full max-w-md shadow-xl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm text-zinc-700 mb-2">Lớp</label>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">Chọn lớp</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-700 mb-2">Ngày</label>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-700 mb-2">Giờ bắt đầu</label>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-700 mb-2">Giờ kết thúc</label>
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </div>
          </div>

          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3">
            <p className="text-sm text-zinc-700">
              💡 Buổi học ngoài lịch recurring. Học phí sẽ được tính bình thường.
            </p>
          </div>

          {(localError || error) && <p className="text-sm text-red-600">{localError || error}</p>}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium disabled:opacity-60"
            >
              {submitting ? "Đang thêm..." : "Thêm buổi học"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
