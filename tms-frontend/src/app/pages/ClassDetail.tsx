import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, BarChart3, BookOpen, Calendar, CheckCircle2, ExternalLink, Plus, Search, Server, Trash2, Users, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import { ApiError } from "../services/apiClient";
import { getClassDetails, type BackendClassDetails, type BackendClassSchedule } from "../services/classService";
import {
  bindClassTopic,
  listTopics,
  unbindClassTopic,
  type BackendTopic,
} from "../services/topicService";

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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("vi-VN");
}

function formatDecimal(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 1,
  }).format(value);
}

function dayLabel(schedule: BackendClassSchedule): string {
  return DAY_OPTIONS.find((item) => item.value === schedule.day_of_week)?.label ?? `Thứ ${schedule.day_of_week}`;
}

export function ClassDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const classId = Number(params.classId);

  const [details, setDetails] = useState<BackendClassDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState("");
  const [gymModalOpen, setGymModalOpen] = useState(false);
  const [gymContests, setGymContests] = useState<BackendTopic[]>([]);
  const [gymSearch, setGymSearch] = useState("");
  const [gymLoading, setGymLoading] = useState(false);
  const [bindingGym, setBindingGym] = useState(false);
  const [bindError, setBindError] = useState("");
  const [unbindingTopicId, setUnbindingTopicId] = useState<number | null>(null);

  const loadClassDetails = async () => {
    if (!Number.isInteger(classId) || classId <= 0) {
      setRequestError("class_id không hợp lệ");
      setLoading(false);
      return;
    }

    setLoading(true);
    setRequestError("");

    try {
      setDetails(await getClassDetails(classId));
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const loadGymContests = async () => {
    setGymLoading(true);
    setBindError("");

    try {
      const allTopics = await listTopics({ classId });
      // Catalog entries: class_id is null, gym_id is not null
      setGymContests(allTopics.filter((t) => t.class_id === null && t.gym_id));
    } catch (error) {
      setBindError(toErrorMessage(error));
    } finally {
      setGymLoading(false);
    }
  };

  const openGymModal = async () => {
    setGymModalOpen(true);
    setGymSearch("");
    await loadGymContests();
  };

  useEffect(() => {
    void loadClassDetails();
  }, [classId]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
          <p className="text-zinc-600">Đang tải chi tiết lớp...</p>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="p-8">
        {requestError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {requestError}
          </div>
        )}
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center mb-6">
          <p className="text-zinc-600">Không tìm thấy lớp.</p>
        </div>
        <Link to="/classes" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách lớp
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8">
      <Link to="/classes" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" />
        Quay lại danh sách lớp
      </Link>

      {requestError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {requestError}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-semibold text-zinc-900">{details.class.name}</h1>
          <p className="text-zinc-600">
            {details.is_ready ? "Đủ điều kiện hoạt động" : "Chưa đủ điều kiện hoạt động"}
          </p>
        </div>
        <span className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-medium ${
          details.class.status === "active"
            ? "bg-zinc-900 text-white"
            : "bg-zinc-100 text-zinc-600"
        }`}
        >
          {details.class.status === "active" ? "Đang mở" : "Đã đóng"}
        </span>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={<CheckCircle2 className="h-5 w-5 text-zinc-400" />} label="Học phí/buổi" value={`${Number(details.class.fee_per_session).toLocaleString("vi-VN")} VNĐ`} />
        <SummaryCard icon={<Users className="h-5 w-5 text-zinc-400" />} label="Học sinh active" value={String(details.active_students.length)} />
        <SummaryCard icon={<Server className="h-5 w-5 text-zinc-400" />} label="Discord guild" value={details.discord_guild?.name ?? "Chưa gắn"} />
        <SummaryCard icon={<BookOpen className="h-5 w-5 text-zinc-400" />} label="GYM" value={String(details.topics.length)} />
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">Lịch học</h2>
          <div className="rounded-xl border border-zinc-200 bg-white">
            {details.schedules.length === 0 ? (
              <p className="p-4 text-sm text-zinc-600">Chưa có lịch học.</p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {details.schedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-zinc-400" />
                      <span className="text-sm text-zinc-700">{dayLabel(schedule)}</span>
                    </div>
                    <span className="text-sm font-medium text-zinc-900">
                      {schedule.start_time.slice(0, 5)}-{schedule.end_time.slice(0, 5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">Codeforces GYM</h2>
            {details.class.status === "active" && (
              <button
                type="button"
                onClick={() => void openGymModal()}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                <Plus className="h-4 w-4" />
                Gắn GYM
              </button>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {details.topics.length === 0 ? (
              <p className="p-5 text-sm text-zinc-600">Chưa có GYM gắn với lớp này.</p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {details.topics.map((topic) => (
                  <div key={topic.id} className="p-5">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-zinc-500" />
                          <h3 className="font-semibold text-zinc-900">{topic.title}</h3>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {topic.gym_id ? `GYM ${topic.gym_id}` : "Chưa có GYM ID"} · Tạo: {formatDate(topic.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex w-fit rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
                          Codeforces
                        </span>
                        {details.class.status === "active" && (
                          <button
                            type="button"
                            disabled={unbindingTopicId === topic.id}
                            onClick={async () => {
                              if (!window.confirm(`Bạn có chắc muốn gỡ GYM "${topic.title}"? Tất cả dữ liệu standing sẽ bị xoá.`)) {
                                return;
                              }

                              setUnbindingTopicId(topic.id);
                              try {
                                await unbindClassTopic(details.class.id, topic.id);
                                await loadClassDetails();
                              } catch (error) {
                                setRequestError(toErrorMessage(error));
                              } finally {
                                setUnbindingTopicId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                          >
                            <Trash2 className="h-3 w-3" />
                            {unbindingTopicId === topic.id ? "Đang gỡ..." : "Gỡ"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
                      <Metric label="Số bài" value={String(topic.progress.total_problems)} />
                      <Metric label="Solved" value={String(topic.progress.solved_count)} />
                      <Metric label="Hoàn thành" value={`${topic.progress.completed_students}/${topic.progress.total_students} HS`} />
                      <Metric label="TB solved/HS" value={formatDecimal(topic.progress.average_solved)} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {topic.problems.slice(0, 12).map((problem) => (
                        <span key={problem.id} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700">
                          {problem.problem_index}{problem.problem_name ? ` · ${problem.problem_name}` : ""}
                        </span>
                      ))}
                      {topic.problems.length > 12 && (
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-500">
                          +{topic.problems.length - 12} bài
                        </span>
                      )}
                      <a
                        href={topic.gym_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-1 text-xs text-white hover:bg-zinc-800"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Codeforces
                      </a>
                      <button
                        type="button"
                        onClick={() => navigate(`/classes/${details.class.id}/gyms/${topic.id}/standing`)}
                        className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                      >
                        <BarChart3 className="h-3 w-3" />
                        Xem standing
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">Học sinh</h2>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {details.active_students.length === 0 ? (
              <p className="p-5 text-sm text-zinc-600">Chưa có học sinh active.</p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {details.active_students.map((student) => (
                  <div key={student.id} className="grid grid-cols-1 gap-2 p-5 md:grid-cols-[1.5fr_1fr_1fr]">
                    <div>
                      <p className="font-medium text-zinc-900">{student.full_name}</p>
                      <p className="text-xs text-zinc-500">Vào lớp: {formatDate(student.enrolled_at)}</p>
                    </div>
                    <p className="text-sm text-zinc-700">{student.codeforces_handle ?? "N/A"}</p>
                    <p className="text-sm text-zinc-700">{student.discord_username ?? "Chưa authorize Discord"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {gymModalOpen && (
        <CodeforcesGymPickerModal
          contests={gymContests}
          existingGymIds={new Set(details.topics.map((topic) => topic.gym_id).filter((gymId): gymId is string => Boolean(gymId)))}
          loading={gymLoading}
          binding={bindingGym}
          error={bindError}
          search={gymSearch}
          onSearchChange={setGymSearch}
          onSearch={() => void loadGymContests()}
          onClose={() => setGymModalOpen(false)}
          onBind={async (gymId) => {
            setBindingGym(true);
            setBindError("");

            try {
              await bindClassTopic(details.class.id, { gym_id: gymId });
              setGymModalOpen(false);
              await loadClassDetails();
            } catch (error) {
              setBindError(toErrorMessage(error));
            } finally {
              setBindingGym(false);
            }
          }}
        />
      )}
    </div>
  );
}

function CodeforcesGymPickerModal({
  contests,
  existingGymIds,
  loading,
  binding,
  error,
  search,
  onSearchChange,
  onSearch,
  onClose,
  onBind,
}: {
  contests: BackendTopic[];
  existingGymIds: Set<string>;
  loading: boolean;
  binding: boolean;
  error: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onClose: () => void;
  onBind: (gymId: string) => Promise<void>;
}) {
  const [selectedGymId, setSelectedGymId] = useState("");
  const selectedAlreadyBound = selectedGymId ? existingGymIds.has(selectedGymId) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Chọn GYM đã sync</h2>
            <p className="text-sm text-zinc-500">Danh sách này lấy từ cache đồng bộ Codeforces.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              onSearch();
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                placeholder="Tìm theo GYM ID hoặc tên contest"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
            >
              {loading ? "Đang tìm..." : "Tìm"}
            </button>
          </form>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="max-h-96 overflow-y-auto rounded-lg border border-zinc-200">
            {loading ? (
              <p className="p-5 text-sm text-zinc-600">Đang tải GYM đã sync...</p>
            ) : contests.length === 0 ? (
              <p className="p-5 text-sm text-zinc-600">Chưa có GYM nào trong cache sync.</p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {contests.filter((contest) => {
                  if (!search.trim()) return true;
                  const q = search.trim().toLowerCase();
                  return (
                    (contest.gym_id ?? "").includes(q) ||
                    contest.title.toLowerCase().includes(q)
                  );
                }).map((contest) => {
                  const alreadyBound = contest.gym_id ? existingGymIds.has(contest.gym_id) : false;

                  return (
                    <label
                      key={contest.id}
                      className={`flex cursor-pointer items-start gap-3 p-4 ${
                        alreadyBound ? "bg-zinc-50 text-zinc-500" : "hover:bg-zinc-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="gym_id"
                        value={contest.gym_id ?? ""}
                        checked={selectedGymId === (contest.gym_id ?? "")}
                        disabled={alreadyBound}
                        onChange={(event) => setSelectedGymId(event.target.value)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-zinc-900">{contest.title}</p>
                          {alreadyBound && (
                            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600">Đã gắn</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          GYM {contest.gym_id} · Sync: {contest.last_pulled_at ? formatDate(contest.last_pulled_at) : "Chưa sync"}
                        </p>
                      </div>
                      <a
                        href={contest.gym_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-2 text-zinc-500 hover:bg-white hover:text-zinc-900"
                        aria-label="Mở Codeforces"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!selectedGymId || selectedAlreadyBound || binding}
            onClick={() => void onBind(selectedGymId)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {binding ? "Đang gắn..." : "Gắn vào lớp"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-3">
        {icon}
        <span className="text-sm text-zinc-500">{label}</span>
      </div>
      <p className="font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
