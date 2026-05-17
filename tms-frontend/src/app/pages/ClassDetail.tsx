import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, BookOpen, Calendar, CheckCircle2, ExternalLink, Server, Users } from "lucide-react";
import { Link, useParams } from "react-router";

import { ApiError } from "../services/apiClient";
import { getClassDetails, type BackendClassDetails, type BackendClassSchedule } from "../services/classService";

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
  const classId = Number(params.classId);

  const [details, setDetails] = useState<BackendClassDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    const loadData = async () => {
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

    void loadData();
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
        <SummaryCard icon={<BookOpen className="h-5 w-5 text-zinc-400" />} label="Chuyên đề" value={String(details.topics.length)} />
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
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">Chuyên đề</h2>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {details.topics.length === 0 ? (
              <p className="p-5 text-sm text-zinc-600">Chưa có chuyên đề gắn với lớp này.</p>
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
                      <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${
                        topic.status === "active"
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                      >
                        {topic.status === "active" ? "Đang mở" : "Đã đóng"}
                      </span>
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
