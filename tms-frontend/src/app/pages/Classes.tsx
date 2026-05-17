import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Edit2, Archive, Users, Trash2, MessageSquare } from "lucide-react";

import { ApiError } from "../services/apiClient";
import {
  type BackendClass,
  type BackendClassSchedule,
  archiveClass,
  createClass,
  listClassSchedules,
  listClasses,
  updateClass,
} from "../services/classService";
import { listStudents } from "../services/studentService";
import {
  listDiscordGuilds,
  sendChannelPost,
  unbindDiscordGuildByClass,
  upsertDiscordGuildByClass,
  type BackendClassDiscordBinding,
} from "../services/messagingService";

type ClassCard = {
  id: number;
  name: string;
  schedule: string;
  feePerSession: number;
  status: "active" | "archived";
  studentCount: number;
  schedules: BackendClassSchedule[];
  discordServerId: number | null;
  discordServerName: string | null;
};

type ClassSchedulePayload = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type ScheduleDraft = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
};

const DAY_OPTIONS = [
  { value: 0, label: "Chủ nhật" },
  { value: 1, label: "Thứ 2" },
  { value: 2, label: "Thứ 3" },
  { value: 3, label: "Thứ 4" },
  { value: 4, label: "Thứ 5" },
  { value: 5, label: "Thứ 6" },
  { value: 6, label: "Thứ 7" },
] as const;

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Đã có lỗi xảy ra";
}

function parseAmount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatScheduleSummary(schedules: BackendClassSchedule[]): string {
  if (schedules.length === 0) {
    return "Chưa thiết lập";
  }

  const rows = schedules.map((schedule) => {
    const dayLabel = DAY_OPTIONS.find((item) => item.value === schedule.day_of_week)?.label ?? `Thứ ${schedule.day_of_week}`;
    return `${dayLabel} ${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)}`;
  });

  return Array.from(new Set(rows)).join(", ");
}

async function buildClassCards(rawClasses: BackendClass[], servers: BackendClassDiscordBinding[]): Promise<ClassCard[]> {
  const [students, scheduleRows] = await Promise.all([
    listStudents({ status: "active" }),
    Promise.all(
      rawClasses.map(async (classItem) => ({
        class_id: classItem.id,
        schedules: await listClassSchedules(classItem.id),
      })),
    ),
  ]);

  const studentCountByClassId = new Map<number, number>();
  students.forEach((student) => {
    if (student.current_class_id === null) {
      return;
    }

    studentCountByClassId.set(
      student.current_class_id,
      (studentCountByClassId.get(student.current_class_id) ?? 0) + 1,
    );
  });

  const scheduleByClassId = new Map<number, string>(
    scheduleRows.map((row) => [row.class_id, formatScheduleSummary(row.schedules)]),
  );
  const schedulesByClassId = new Map<number, BackendClassSchedule[]>(
    scheduleRows.map((row) => [row.class_id, row.schedules]),
  );
  const serverByClassId = new Map<number, BackendClassDiscordBinding>();
  servers.forEach((server) => {
    if (server.binding.role === "class" && server.binding.class_id !== null) {
      serverByClassId.set(server.binding.class_id, server);
    }
  });

  return rawClasses.map((classItem) => ({
    ...(() => {
      const server = serverByClassId.get(classItem.id);
      return {
        discordServerId: server?.id ?? null,
        discordServerName: server?.name ?? null,
      };
    })(),
    id: classItem.id,
    name: classItem.name,
    schedule: scheduleByClassId.get(classItem.id) ?? "Chưa thiết lập",
    feePerSession: parseAmount(classItem.fee_per_session),
    status: classItem.status,
    studentCount: studentCountByClassId.get(classItem.id) ?? 0,
    schedules: schedulesByClassId.get(classItem.id) ?? [],
  }));
}

export function Classes() {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassCard | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showClassMessageModal, setShowClassMessageModal] = useState(false);
  const [classes, setClasses] = useState<ClassCard[]>([]);
  const [discordGuilds, setDiscordGuilds] = useState<BackendClassDiscordBinding[]>([]);
  const [requestError, setRequestError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refreshClasses = async (): Promise<void> => {
    const [rawClasses, servers] = await Promise.all([
      listClasses(),
      listDiscordGuilds(),
    ]);
    const classCards = await buildClassCards(rawClasses, servers);
    setClasses(classCards);
    setDiscordGuilds(servers);
  };

  useEffect(() => {
    const loadClasses = async () => {
      try {
        setRequestError("");
        await refreshClasses();
      } catch (error) {
        setRequestError(toErrorMessage(error));
      }
    };

    void loadClasses();
  }, []);

  const activeClasses = useMemo(
    () => classes.filter((classItem) => classItem.status === "active"),
    [classes],
  );
  const archivedClasses = useMemo(
    () => classes.filter((classItem) => classItem.status === "archived"),
    [classes],
  );

  const handleCreateClass = async (payload: {
    name: string;
    feePerSession: number;
    schedules: ClassSchedulePayload[];
    serverId: number | null;
  }) => {
    setSubmitting(true);
    setRequestError("");

    try {
      const createdClass = await createClass({
        name: payload.name,
        fee_per_session: payload.feePerSession,
        schedules: payload.schedules,
      });
      if (payload.serverId !== null) {
        await upsertDiscordGuildByClass(createdClass.id, {
          guild_id: payload.serverId,
        });
      }

      await refreshClasses();
      setShowAddModal(false);
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateClass = async (payload: {
    classId: number;
    name: string;
    feePerSession: number;
    schedules: ClassSchedulePayload[];
    serverId: number | null;
  }) => {
    setSubmitting(true);
    setRequestError("");

    try {
      await updateClass(payload.classId, {
        name: payload.name,
        fee_per_session: payload.feePerSession,
        schedules: payload.schedules,
      });
      if (payload.serverId !== null) {
        await upsertDiscordGuildByClass(payload.classId, {
          guild_id: payload.serverId,
        });
      } else if (selectedClass?.discordServerId != null) {
        await unbindDiscordGuildByClass(payload.classId);
      }
      await refreshClasses();
      setShowEditModal(false);
      setSelectedClass(null);
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveClass = async (classId: number) => {
    setSubmitting(true);
    setRequestError("");

    try {
      await archiveClass(classId);
      await refreshClasses();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendClassMessage = async (payload: {
    classId: number;
    content: string;
  }) => {
    setSubmitting(true);
    setRequestError("");

    try {
      const server = discordGuilds.find((item) => (
        item.binding.role === "class"
        && item.binding.class_id === payload.classId
        && item.binding.notification_channel_id
      ));

      if (!server) {
        setRequestError("Lớp này chưa cấu hình Discord notification channel");
        return;
      }

      const serverBindingId = server.binding.guild_binding_id;
      if (!serverBindingId) {
        setRequestError("Lớp này chưa gắn Discord guild hợp lệ");
        return;
      }

      const result = await sendChannelPost({
        content: payload.content,
        guild_ids: [serverBindingId],
      });
      if (result.failed > 0) {
        setRequestError(result.failures[0]?.error ?? "Không gửi được tin nhắn vào Discord channel");
        return;
      }

      setShowClassMessageModal(false);
      setSelectedClass(null);
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
          <h1 className="text-3xl font-semibold text-zinc-900 mb-2">Quản lý lớp học</h1>
          <p className="text-zinc-600">
            {activeClasses.length} lớp đang mở
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-3 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Tạo lớp mới
        </button>
      </div>

      {requestError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {requestError}
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">Lớp đang mở</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeClasses.map((cls) => (
            <div
              key={cls.id}
              onClick={() => navigate(`/classes/${cls.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/classes/${cls.id}`);
                }
              }}
              className="bg-white border border-zinc-200 rounded-xl p-6 hover:border-zinc-700 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-zinc-900 mb-1">{cls.name}</h3>
                  <div className="flex items-center gap-2 text-zinc-600 text-sm">
                    <Users className="w-4 h-4" />
                    <span>{cls.studentCount} học sinh</span>
                  </div>
                </div>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedClass(cls);
                    setShowEditModal(true);
                  }}
                  className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                  title="Chỉnh sửa lớp"
                >
                  <Edit2 className="w-4 h-4 text-zinc-600" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 p-3 bg-zinc-100 rounded-lg">
                  <span className="text-zinc-600 text-sm shrink-0">Lịch học</span>
                  <span className="text-zinc-900 text-sm text-right">{cls.schedule}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-zinc-100 rounded-lg">
                  <span className="text-zinc-600 text-sm">Học phí/buổi</span>
                  <span className="text-zinc-900 font-semibold">
                    {(cls.feePerSession / 1000).toFixed(0)}K
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 p-3 bg-zinc-100 rounded-lg">
                  <span className="text-zinc-600 text-sm shrink-0">Discord guild</span>
                  <span className="text-zinc-900 text-sm text-right">{cls.discordServerName ?? "Chưa gắn"}</span>
                </div>
              </div>

              <button
                className="w-full mt-4 px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedClass(cls);
                  setShowClassMessageModal(true);
                }}
                disabled={submitting}
              >
                <MessageSquare className="w-4 h-4" />
                Nhắn nhóm lớp
              </button>

              <button
                className="w-full mt-4 px-4 py-2 bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleArchiveClass(cls.id);
                }}
                disabled={submitting}
              >
                <Archive className="w-4 h-4" />
                Đóng lớp
              </button>
            </div>
          ))}
        </div>
      </div>

      {archivedClasses.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">Lớp đã đóng</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {archivedClasses.map((cls) => (
              <div
                key={cls.id}
                onClick={() => navigate(`/classes/${cls.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/classes/${cls.id}`);
                  }
                }}
                className="bg-white border border-zinc-200 rounded-xl p-6 opacity-60 cursor-pointer hover:border-zinc-700 transition-colors"
              >
                <h3 className="text-xl font-semibold text-zinc-900 mb-1">{cls.name}</h3>
                <p className="text-zinc-600 text-sm mb-4">{cls.schedule}</p>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-sm">
                    Đã đóng
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddModal && (
        <AddClassModal
          servers={discordGuilds}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleCreateClass}
          submitting={submitting}
          error={requestError}
        />
      )}

      {showEditModal && selectedClass && (
        <EditClassModal
          classData={selectedClass}
          servers={discordGuilds}
          onClose={() => {
            setShowEditModal(false);
            setSelectedClass(null);
          }}
          onSubmit={handleUpdateClass}
          submitting={submitting}
          error={requestError}
        />
      )}

      {showClassMessageModal && selectedClass && (
        <ClassMessageModal
          classData={selectedClass}
          submitting={submitting}
          error={requestError}
          onClose={() => {
            setShowClassMessageModal(false);
            setSelectedClass(null);
          }}
          onSubmit={handleSendClassMessage}
        />
      )}

    </div>
  );
}

function ClassMessageModal({
  classData,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  classData: ClassCard;
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (payload: { classId: number; content: string }) => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError("");

    if (!content.trim()) {
      setLocalError("Nội dung tin nhắn là bắt buộc");
      return;
    }

    await onSubmit({
      classId: classData.id,
      content: content.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-6 w-full max-w-lg">
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">Nhắn nhóm {classData.name}</h2>
        <p className="text-sm text-zinc-600 mb-6">Tin nhắn sẽ được gửi vào Discord notification channel của lớp.</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={8}
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            placeholder="Nhập nội dung thông báo..."
          />

          {(localError || error) && <p className="text-sm text-red-600">{localError || error}</p>}

          <div className="flex gap-3 pt-2">
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
              {submitting ? "Đang gửi..." : "Gửi tin nhắn"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function createScheduleDraft(schedule?: BackendClassSchedule): ScheduleDraft {
  return {
    id: schedule ? `schedule-${schedule.id}` : `new-${crypto.randomUUID()}`,
    dayOfWeek: String(schedule?.day_of_week ?? 1),
    startTime: schedule?.start_time.slice(0, 5) ?? "",
    endTime: schedule?.end_time.slice(0, 5) ?? "",
  };
}

function validateScheduleDrafts(schedules: ScheduleDraft[]): ClassSchedulePayload[] {
  return schedules.map((schedule, index) => {
    const parsedDay = Number(schedule.dayOfWeek);
    const rowLabel = `Lịch học ${index + 1}`;

    if (!Number.isInteger(parsedDay) || parsedDay < 0 || parsedDay > 6) {
      throw new Error(`${rowLabel}: thứ học không hợp lệ`);
    }

    if (!schedule.startTime) {
      throw new Error(`${rowLabel}: vui lòng chọn giờ bắt đầu`);
    }

    if (!schedule.endTime) {
      throw new Error(`${rowLabel}: vui lòng chọn giờ kết thúc`);
    }

    if (schedule.endTime <= schedule.startTime) {
      throw new Error(`${rowLabel}: giờ kết thúc phải lớn hơn giờ bắt đầu`);
    }

    return {
      day_of_week: parsedDay,
      start_time: schedule.startTime,
      end_time: schedule.endTime,
    };
  });
}

function ScheduleEditor({
  schedules,
  onChange,
}: {
  schedules: ScheduleDraft[];
  onChange: (schedules: ScheduleDraft[]) => void;
}) {
  const updateSchedule = (id: string, patch: Partial<Omit<ScheduleDraft, "id">>) => {
    onChange(schedules.map((schedule) => (
      schedule.id === id ? { ...schedule, ...patch } : schedule
    )));
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-800">Lịch học</p>
          <p className="text-xs text-zinc-500">Bắt buộc. Lịch đã lưu sẽ tự tạo buổi học tương lai.</p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...schedules, createScheduleDraft()])}
          className="shrink-0 px-3 py-2 bg-zinc-100 text-zinc-800 rounded-lg text-sm hover:bg-zinc-200 transition-colors"
        >
          Thêm lịch
        </button>
      </div>

      {schedules.length === 0 ? (
        <p className="text-sm text-zinc-500">Chưa thiết lập lịch học.</p>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
              <div>
                <label className="block text-xs text-zinc-600 mb-1">Thứ học</label>
                <select
                  value={schedule.dayOfWeek}
                  onChange={(event) => updateSchedule(schedule.id, { dayOfWeek: event.target.value })}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                >
                  {DAY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1">Bắt đầu</label>
                <input
                  type="time"
                  value={schedule.startTime}
                  onChange={(event) => updateSchedule(schedule.id, { startTime: event.target.value })}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1">Kết thúc</label>
                <input
                  type="time"
                  value={schedule.endTime}
                  onChange={(event) => updateSchedule(schedule.id, { endTime: event.target.value })}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </div>
              <button
                type="button"
                onClick={() => onChange(schedules.filter((item) => item.id !== schedule.id))}
                className="p-2 rounded-lg text-zinc-600 hover:bg-zinc-100 transition-colors sm:self-end"
                title="Xóa lịch"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddClassModal({
  servers,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  servers: BackendClassDiscordBinding[];
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    feePerSession: number;
    schedules: ClassSchedulePayload[];
    serverId: number | null;
  }) => Promise<void>;
  submitting: boolean;
  error: string;
}) {
  const [name, setName] = useState("");
  const [feePerSession, setFeePerSession] = useState("");
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([]);
  const [serverId, setServerId] = useState("");
  const [localError, setLocalError] = useState("");
  const availableServers = servers.filter((server) => server.binding.role === "unbound");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError("");

    const normalizedName = name.trim();
    const parsedFee = Number(feePerSession);

    if (!normalizedName) {
      setLocalError("Tên lớp là bắt buộc");
      return;
    }

    if (!Number.isInteger(parsedFee) || parsedFee < 0) {
      setLocalError("Học phí/buổi phải là số nguyên không âm");
      return;
    }

    const parsedServerId = serverId ? Number(serverId) : null;
    if (parsedServerId !== null && (!Number.isInteger(parsedServerId) || parsedServerId <= 0)) {
      setLocalError("Discord guild không hợp lệ");
      return;
    }

    let schedulePayloads: ClassSchedulePayload[];
    try {
      schedulePayloads = validateScheduleDrafts(schedules);
    } catch (validationError) {
      setLocalError(toErrorMessage(validationError));
      return;
    }
    if (schedulePayloads.length === 0) {
      setLocalError("Lớp phải có ít nhất một lịch học");
      return;
    }

    await onSubmit({
      name: normalizedName,
      feePerSession: parsedFee,
      schedules: schedulePayloads,
      serverId: parsedServerId,
    });
  };

  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-6 w-full max-w-lg">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm text-zinc-600 mb-2">Tên lớp</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="Lớp Cơ Bản"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-600 mb-2">Học phí/buổi (VNĐ)</label>
            <input
              type="number"
              min={0}
              value={feePerSession}
              onChange={(event) => setFeePerSession(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="150000"
            />
          </div>

          <ScheduleEditor schedules={schedules} onChange={setSchedules} />

          <div>
            <label className="block text-sm text-zinc-600 mb-2">Discord guild</label>
            <select
              value={serverId}
              onChange={(event) => setServerId(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">Không gắn server</option>
              {availableServers.map((server) => (
                <option key={server.id} value={server.id}>{server.name}</option>
              ))}
            </select>
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
              className="flex-1 px-4 py-3 bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors font-medium"
            >
              {submitting ? "Đang tạo..." : "Tạo lớp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditClassModal({
  classData,
  servers,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  classData: ClassCard;
  servers: BackendClassDiscordBinding[];
  onClose: () => void;
  onSubmit: (payload: {
    classId: number;
    name: string;
    feePerSession: number;
    schedules: ClassSchedulePayload[];
    serverId: number | null;
  }) => Promise<void>;
  submitting: boolean;
  error: string;
}) {
  const [name, setName] = useState(classData.name);
  const [feePerSession, setFeePerSession] = useState(String(classData.feePerSession));
  const [schedules, setSchedules] = useState<ScheduleDraft[]>(
    classData.schedules.map((schedule) => createScheduleDraft(schedule)),
  );
  const [serverId, setServerId] = useState(classData.discordServerId ? String(classData.discordServerId) : "");
  const [localError, setLocalError] = useState("");
  const availableServers = classData.discordServerId
    ? servers.filter((server) => server.id === classData.discordServerId)
    : servers.filter((server) => server.binding.role === "unbound");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError("");

    const parsedFee = Number(feePerSession);
    const normalizedName = name.trim();

    if (!normalizedName) {
      setLocalError("Tên lớp là bắt buộc");
      return;
    }

    if (!Number.isInteger(parsedFee) || parsedFee < 0) {
      setLocalError("Học phí/buổi phải là số nguyên không âm");
      return;
    }

    const parsedServerId = serverId ? Number(serverId) : null;
    if (parsedServerId !== null && (!Number.isInteger(parsedServerId) || parsedServerId <= 0)) {
      setLocalError("Discord guild không hợp lệ");
      return;
    }

    let schedulePayloads: ClassSchedulePayload[];
    try {
      schedulePayloads = validateScheduleDrafts(schedules);
    } catch (validationError) {
      setLocalError(toErrorMessage(validationError));
      return;
    }
    if (schedulePayloads.length === 0) {
      setLocalError("Lớp phải có ít nhất một lịch học");
      return;
    }

    await onSubmit({
      classId: classData.id,
      name: normalizedName,
      feePerSession: parsedFee,
      schedules: schedulePayloads,
      serverId: parsedServerId,
    });
  };

  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-6 w-full max-w-lg">
        <h2 className="text-xl font-semibold text-zinc-900 mb-6">Chỉnh sửa lớp</h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm text-zinc-600 mb-2">Tên lớp</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-600 mb-2">Học phí/buổi (VNĐ)</label>
            <input
              type="number"
              value={feePerSession}
              onChange={(event) => setFeePerSession(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
            <p className="text-xs text-zinc-600 mt-2">
              ⚠️ Thay đổi chỉ áp dụng từ buổi tiếp theo
            </p>
          </div>

          <ScheduleEditor schedules={schedules} onChange={setSchedules} />

          <div>
            <label className="block text-sm text-zinc-600 mb-2">Discord guild</label>
            <select
              value={serverId}
              onChange={(event) => setServerId(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">Không gắn server</option>
              {availableServers.map((server) => (
                <option key={server.id} value={server.id}>{server.name}</option>
              ))}
            </select>
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
              className="flex-1 px-4 py-3 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium"
            >
              {submitting ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
