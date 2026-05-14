import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  AlertCircle,
  BookOpenCheck,
  CheckCircle,
  CircleDollarSign,
  Hash,
  Link2,
  ListChecks,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings,
  TriangleAlert,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { ApiError } from "../services/apiClient";
import { listSessionAttendance } from "../services/attendanceService";
import { getDiscordVerificationAuthorizeUrl, getMe } from "../services/authService";
import { listClasses, listSessions } from "../services/classService";
import { listStudentBalances } from "../services/financeService";
import {
  getDiscordBotInviteLink,
  getDiscordSetupStatus,
  listDiscordChannels,
  listDiscordServers,
  sendStudentMessages,
  sendChannelPost,
  syncDiscordMembership,
  syncDiscordServers,
  upsertDiscordServerByClass,
  type BackendDiscordChannel,
  type BackendDiscordServer,
  type DiscordMembershipSyncResult,
  type DiscordSetupStatus,
} from "../services/messagingService";
import { getStudentLearningProfile } from "../services/reportingService";
import { listStudents } from "../services/studentService";

type BulkRecipientFilter = "debt" | "incomplete_topic" | "recent_absence";

type ClassOption = {
  id: number;
  name: string;
};

type StudentOption = {
  id: number;
  name: string;
  class_id: number | null;
  discord_username: string | null;
  has_debt: boolean;
  has_incomplete_topic: boolean;
  absent_in_recent_session: boolean;
};

const MESSAGE_TEMPLATES = [
  { id: "custom", label: "Tin nhắn tùy chỉnh", content: "" },
  {
    id: "debt_reminder",
    label: "Nhắc học phí",
    content: "Chào bạn, hiện bạn còn nợ học phí. Vui lòng hoàn tất thanh toán trước buổi học tiếp theo. Nếu đã chuyển khoản, hãy phản hồi lại tin nhắn này.",
  },
  {
    id: "topic_progress",
    label: "Nhắc tiến độ chuyên đề",
    content: "Chào bạn, chuyên đề tuần này còn bài chưa hoàn thành. Bạn vui lòng kiểm tra và hoàn thành các bài còn lại để được ghi nhận đầy đủ.",
  },
  {
    id: "attendance_warning",
    label: "Nhắc chuyên cần",
    content: "Chào bạn, buổi học gần đây bạn vắng mặt. Vui lòng phản hồi lý do và sắp xếp tham gia đầy đủ các buổi tiếp theo.",
  },
  {
    id: "general_announcement",
    label: "Thông báo chung",
    content: "Thông báo:\n\n[Nội dung thông báo]\n\nCảm ơn các bạn.",
  },
] as const;

const BULK_RECIPIENT_FILTERS = [
  { id: "debt", label: "Còn nợ", icon: CircleDollarSign },
  { id: "incomplete_topic", label: "Chưa hoàn thành bài tập", icon: BookOpenCheck },
  { id: "recent_absence", label: "Vắng buổi gần đây", icon: TriangleAlert },
] as const satisfies ReadonlyArray<{
  id: BulkRecipientFilter;
  label: string;
  icon: LucideIcon;
}>;

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

export function Messaging() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showSyncServersModal, setShowSyncServersModal] = useState(false);
  const [showBindServerModal, setShowBindServerModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedServer, setSelectedServer] = useState<BackendDiscordServer | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null);
  const [requestError, setRequestError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [servers, setServers] = useState<BackendDiscordServer[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [discordStatus, setDiscordStatus] = useState<DiscordSetupStatus | null>(null);
  const [botInviteLink, setBotInviteLink] = useState<string | null>(null);
  const [teacherDiscordUsername, setTeacherDiscordUsername] = useState<string | null>(null);
  const [teacherDiscordVerifiedAt, setTeacherDiscordVerifiedAt] = useState<string | null>(null);
  const [membershipSyncResult, setMembershipSyncResult] = useState<DiscordMembershipSyncResult | null>(null);

  const loadData = async () => {
    setRequestError("");
    try {
      const [
        serverList,
        setupStatus,
        inviteLink,
        me,
        classList,
        studentList,
        balances,
        sessions,
      ] = await Promise.all([
        listDiscordServers(),
        getDiscordSetupStatus(),
        getDiscordBotInviteLink(),
        getMe(),
        listClasses("active"),
        listStudents({ status: "active" }),
        listStudentBalances({ status: "active", include_pending_archive: false }),
        listSessions(),
      ]);

      const debtStudentIds = new Set(
        balances
          .filter((balance) => parseAmount(balance.balance) < 0)
          .map((balance) => balance.student_id),
      );

      const incompleteTopicResults = await Promise.all(studentList.map(async (student) => {
        try {
          const profile = await getStudentLearningProfile(student.id);
          return {
            studentId: student.id,
            incomplete: profile.topics.some((topic) => topic.total_problems > topic.solved_count),
          };
        } catch {
          return { studentId: student.id, incomplete: false };
        }
      }));

      const incompleteTopicStudentIds = new Set(
        incompleteTopicResults
          .filter((item) => item.incomplete)
          .map((item) => item.studentId),
      );

      const latestSession = sessions
        .filter((session) => session.status !== "cancelled" && new Date(session.scheduled_at).getTime() <= Date.now())
        .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0];

      const absentStudentIds = new Set<number>();
      if (latestSession) {
        try {
          const sessionAttendance = await listSessionAttendance(latestSession.id);
          sessionAttendance.attendance
            .filter((row) => row.attendance_status === "absent_excused" || row.attendance_status === "absent_unexcused")
            .forEach((row) => absentStudentIds.add(row.student_id));
        } catch {
          // Keep the messaging page usable even when recent attendance data is unavailable.
        }
      }

      setServers(serverList);
      setDiscordStatus(setupStatus);
      setBotInviteLink(inviteLink);
      setTeacherDiscordUsername(me.discord_username);
      setTeacherDiscordVerifiedAt(me.discord_verified_at);
      setClasses(classList.map((item) => ({ id: item.id, name: item.name })));
      setStudents(studentList.map((item) => ({
        id: item.id,
        name: item.full_name,
        class_id: item.current_class_id,
        discord_username: item.discord_username,
        has_debt: debtStudentIds.has(item.id),
        has_incomplete_topic: incompleteTopicStudentIds.has(item.id),
        absent_in_recent_session: absentStudentIds.has(item.id),
      })));
    } catch (error) {
      setRequestError(toErrorMessage(error));
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const installStatus = searchParams.get("discord_install");
    const verificationStatus = searchParams.get("discord_verification");
    if (!installStatus && !verificationStatus) {
      return;
    }

    if (verificationStatus === "success") {
      setRequestError("");
      void loadData();
    } else if (verificationStatus === "cancelled") {
      setRequestError("Bạn đã hủy xác thực Discord account.");
    }

    if (installStatus === "success") {
      setRequestError("");
      void loadData();
    } else if (installStatus === "conflict") {
      setRequestError("Server Discord này đã được liên kết với giáo viên khác.");
    } else if (installStatus === "cancelled") {
      setRequestError("Bạn đã hủy thao tác thêm bot vào Discord server.");
    }

    navigate("/messaging", { replace: true });
  }, [navigate, searchParams]);

  const classNameById = useMemo(
    () => new Map(classes.map((item) => [item.id, item.name])),
    [classes],
  );

  const classBoundServers = useMemo(
    () => servers.filter((server) => server.binding.role === "class" && server.binding.class_id !== null),
    [servers],
  );

  const unboundServers = useMemo(
    () => servers.filter((server) => server.binding.role === "unbound"),
    [servers],
  );

  const sendableServers = useMemo(
    () => servers.filter((server) => (
      server.binding.role === "class"
      && Boolean(server.binding.notification_channel_id)
    )),
    [servers],
  );

  const setupStatus = {
    discordAuth: Boolean(teacherDiscordVerifiedAt),
    botConfigured: Boolean(botInviteLink),
    hasServers: servers.length > 0,
    classServersSet: discordStatus ? discordStatus.metrics.classes_missing_server === 0 : classBoundServers.length > 0,
    studentsHaveDiscord: discordStatus ? discordStatus.metrics.students_missing_discord_username === 0 : students.every((student) => student.discord_username),
  };

  const openBotInvite = () => {
    if (botInviteLink) {
      window.open(botInviteLink, "_blank", "noopener,noreferrer");
    }
  };

  const startDiscordVerification = async () => {
    try {
      const authorizeUrl = await getDiscordVerificationAuthorizeUrl();
      window.location.href = authorizeUrl;
    } catch (error) {
      setRequestError(toErrorMessage(error));
    }
  };

  const handleSyncDiscordServers = async () => {
    setSubmitting(true);
    setRequestError("");
    try {
      await syncDiscordServers();
      setShowSyncServersModal(false);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncDiscordMembership = async () => {
    setSubmitting(true);
    setRequestError("");
    try {
      const result = await syncDiscordMembership();
      setMembershipSyncResult(result);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetupIssueAction = (action: DiscordSetupStatus["issues"][number]["cta_action"]) => {
    if (action === "open_bot_invite") {
      openBotInvite();
    } else if (action === "sync_servers") {
      setShowSyncServersModal(true);
    } else if (action === "sync_membership") {
      void handleSyncDiscordMembership();
    } else if (action === "open_class_server") {
      setShowBindServerModal(true);
    } else if (action === "review_students") {
      navigate("/students");
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-3xl font-semibold text-zinc-900">Discord</h1>
          <p className="text-zinc-600">Cấu hình Discord server, bot và kênh thông báo cho lớp học</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openBotInvite}
            disabled={!botInviteLink || !teacherDiscordVerifiedAt}
            className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-3 font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-zinc-100"
          >
            <Server className="h-5 w-5" />
            Mời bot
          </button>
          <button
            type="button"
            onClick={() => { void handleSyncDiscordMembership(); }}
            disabled={submitting || !teacherDiscordVerifiedAt}
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            <RefreshCw className="h-5 w-5" />
            Đồng bộ Discord
          </button>
        </div>
      </div>

      {requestError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {requestError}
        </div>
      )}

      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Trạng thái hệ thống</h2>
            {teacherDiscordVerifiedAt ? (
              <p className="mt-1 text-sm text-zinc-600">
                Discord username: <span className="font-medium">{teacherDiscordUsername ?? "chưa có"}</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-zinc-600">Chưa xác thực Discord account.</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { void startDiscordVerification(); }}
            className="rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
          >
            {teacherDiscordVerifiedAt ? "Xác thực lại" : "Xác thực Discord"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatusItem label="Discord đã xác thực" status={setupStatus.discordAuth} />
          <StatusItem label="Bot đã cấu hình" status={setupStatus.botConfigured} />
          <StatusItem label="Có server Discord" status={setupStatus.hasServers} />
          <StatusItem label="Server lớp đã gắn đủ" status={setupStatus.classServersSet} />
          <StatusItem label="Học sinh có Discord username" status={setupStatus.studentsHaveDiscord} />
        </div>
      </div>

      {discordStatus && discordStatus.issues.length > 0 && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Việc cần xử lý</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {discordStatus.issues.map((issue) => (
              <div key={issue.code} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="font-medium text-zinc-900">{issue.title}</p>
                  <span className="text-xs uppercase tracking-wide text-zinc-500">{issue.severity}</span>
                </div>
                <p className="text-sm text-zinc-700">{issue.description}</p>
                {issue.cta_action && issue.cta_label && (
                  <button
                    type="button"
                    onClick={() => handleSetupIssueAction(issue.cta_action)}
                    disabled={submitting}
                    className="mt-3 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {issue.cta_label}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {membershipSyncResult && (
        <DiscordMembershipSyncPanel result={membershipSyncResult} />
      )}

      <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-zinc-900">Quản lý server Discord</h2>
            <button
              type="button"
              onClick={() => setShowSyncServersModal(true)}
              className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-white transition-colors hover:bg-zinc-800"
            >
              <RefreshCw className="h-4 w-4" />
              Đồng bộ server
            </button>
          </div>

          <section>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-700">Server theo lớp</h3>
            <div className="space-y-4">
              {classes.map((cls) => {
                const server = classBoundServers.find((item) => item.binding.class_id === cls.id);

                return (
                  <div key={cls.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="font-semibold text-zinc-900">{cls.name}</h4>
                      {!server && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClass(cls);
                            setShowBindServerModal(true);
                          }}
                          className="flex items-center gap-1 rounded bg-zinc-100 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-200"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Gắn server
                        </button>
                      )}
                    </div>
                    {server ? (
                      <ServerCard
                        server={server}
                        compact
                        subtitle={classNameById.get(server.binding.class_id ?? 0) ?? "Server lớp"}
                        onConfig={() => {
                          setSelectedServer(server);
                          setShowConfigModal(true);
                        }}
                      />
                    ) : (
                      <p className="text-sm text-zinc-500">Chưa gắn server Discord</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {unboundServers.length > 0 && (
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-700">Server chưa gắn</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {unboundServers.map((server) => (
                  <ServerCard
                    key={server.id}
                    server={server}
                    subtitle="Chưa gắn vào nghiệp vụ"
                    onConfig={() => {
                      setSelectedServer(server);
                      setSelectedClass(null);
                      setShowBindServerModal(true);
                    }}
                  />
                ))}
              </div>
            </section>
          )}
      </div>

      {showSyncServersModal && (
        <SyncServersModal
          submitting={submitting}
          onClose={() => setShowSyncServersModal(false)}
          onSubmit={handleSyncDiscordServers}
        />
      )}

      {showBindServerModal && (
        <ServerModal
          title="Gắn server cho lớp"
          classes={classes}
          servers={servers}
          initialValues={selectedServer ? {
            class_id: selectedServer.binding.class_id ?? selectedClass?.id ?? 0,
            discord_server_id: selectedServer.discord_server_id,
            attendance_voice_channel_id: selectedServer.binding.attendance_voice_channel_cache_id ? String(selectedServer.binding.attendance_voice_channel_cache_id) : "",
            notification_channel_id: selectedServer.binding.notification_channel_cache_id ? String(selectedServer.binding.notification_channel_cache_id) : "",
          } : selectedClass ? {
            class_id: selectedClass.id,
            discord_server_id: "",
            attendance_voice_channel_id: "",
            notification_channel_id: "",
          } : undefined}
          submitting={submitting}
          onClose={() => {
            setShowBindServerModal(false);
            setSelectedServer(null);
            setSelectedClass(null);
          }}
          onSubmit={async (payload) => {
            setSubmitting(true);
            setRequestError("");
            try {
              await upsertDiscordServerByClass(payload.class_id, payload);
              setShowBindServerModal(false);
              setSelectedServer(null);
              setSelectedClass(null);
              await loadData();
            } catch (error) {
              setRequestError(toErrorMessage(error));
            } finally {
              setSubmitting(false);
            }
          }}
        />
      )}

      {showConfigModal && selectedServer && (
        <ServerModal
          title="Cấu hình server"
          classes={classes}
          servers={servers}
          initialValues={{
            class_id: selectedServer.binding.class_id ?? 0,
            discord_server_id: selectedServer.discord_server_id,
            attendance_voice_channel_id: selectedServer.binding.attendance_voice_channel_cache_id ? String(selectedServer.binding.attendance_voice_channel_cache_id) : "",
            notification_channel_id: selectedServer.binding.notification_channel_cache_id ? String(selectedServer.binding.notification_channel_cache_id) : "",
          }}
          submitting={submitting}
          onClose={() => {
            setShowConfigModal(false);
            setSelectedServer(null);
          }}
          onSubmit={async (payload) => {
            setSubmitting(true);
            setRequestError("");
            try {
              await upsertDiscordServerByClass(payload.class_id, payload);
              setShowConfigModal(false);
              setSelectedServer(null);
              await loadData();
            } catch (error) {
              setRequestError(toErrorMessage(error));
            } finally {
              setSubmitting(false);
            }
          }}
        />
      )}
    </div>
  );
}

function StatusItem({ label, status }: { label: string; status: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      {status ? (
        <CheckCircle className="h-5 w-5 text-zinc-700" />
      ) : (
        <XCircle className="h-5 w-5 text-zinc-400" />
      )}
      <span className={`text-sm ${status ? "text-zinc-900" : "text-zinc-500"}`}>
        {label}
      </span>
    </div>
  );
}

function DiscordMembershipSyncPanel({ result }: { result: DiscordMembershipSyncResult }) {
  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Kết quả đồng bộ Discord</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Add học sinh đã authorize vào server lớp hiện tại và gỡ khỏi server lớp cũ nếu đã nghỉ.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm ${
          result.failed === 0 ? "bg-zinc-900 text-white" : "bg-red-50 text-red-700"
        }`}>
          {result.failed === 0 ? "Hoàn tất" : `${result.failed} lỗi`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Server đã sync" value={result.synced_servers} />
        <MetricCard label="Học sinh" value={result.total_students} />
        <MetricCard label="Đã resolve" value={result.resolved_students} />
        <MetricCard label="User ID cập nhật" value={result.discord_user_ids_updated} />
        <MetricCard label="Đang ở server lớp" value={result.already_in_class_server} />
        <MetricCard label="Đã add vào server lớp" value={result.joined_class_server} />
        <MetricCard label="Đã kick khỏi lớp cũ" value={result.kicked_from_class_server} />
        <MetricCard label="Lỗi" value={result.failed} />
      </div>

      {result.failures.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Học sinh</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Lớp</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Lỗi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {result.failures.slice(0, 20).map((failure, index) => (
                <tr key={`${failure.student_id ?? "server"}-${failure.code}-${index}`}>
                  <td className="px-4 py-3 text-sm text-zinc-900">
                    {failure.student_name ?? "Hệ thống"}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600">
                    {failure.class_name ?? "N/A"}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700">
                    <span className="font-mono text-xs text-zinc-500">{failure.code}</span>
                    <p className="mt-1">{failure.message}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.failures.length > 20 && (
            <p className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Còn {result.failures.length - 20} lỗi khác.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ServerCard({
  server,
  subtitle,
  compact = false,
  onConfig,
}: {
  server: BackendDiscordServer;
  subtitle: string;
  compact?: boolean;
  onConfig: () => void;
}) {
  const textChannel = server.binding.notification_channel_name || server.binding.notification_channel_id;

  return (
    <div className={`rounded-xl border border-zinc-200 bg-white shadow-sm ${compact ? "p-4" : "p-6"}`}>
      <div className="flex items-start gap-4">
        {!compact && (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
            <Server className="h-6 w-6 text-zinc-900" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className={`${compact ? "text-base" : "text-lg"} mb-1 truncate font-semibold text-zinc-900`}>
            {server.name}
          </h3>
          <p className="mb-1 truncate text-xs text-zinc-500">{subtitle}</p>
          <p className="mb-3 truncate font-mono text-xs text-zinc-500">ID: {server.discord_server_id}</p>
          <div className="mb-3 flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-zinc-600" />
              <span className="text-sm text-zinc-600">{textChannel ? "Có channel" : "Chưa chọn channel"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-zinc-600" />
              <span className="text-sm text-zinc-600">{server.binding.role === "class" ? "Server lớp" : "Chưa gắn"}</span>
            </div>
          </div>
          {textChannel ? (
            <div className="mb-3 flex items-center gap-2 rounded bg-zinc-50 p-2">
              <Hash className="h-3.5 w-3.5 text-zinc-600" />
              <span className="text-xs text-zinc-600">Channel: {textChannel}</span>
            </div>
          ) : (
            <div className="mb-3 rounded bg-zinc-100 p-2">
              <p className="text-xs text-zinc-500">Chưa chọn channel thông báo</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConfig}
              className="flex items-center gap-1 rounded bg-zinc-100 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-200"
            >
              <Settings className="h-3.5 w-3.5" />
              Cấu hình channel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SendMessageTab({
  classes,
  servers,
  students,
  submitting,
  onSubmit,
}: {
  classes: ClassOption[];
  servers: BackendDiscordServer[];
  students: StudentOption[];
  submitting: boolean;
  onSubmit: (payload:
    | { type: "channel_post"; content: string; server_ids: number[] }
    | { type: "bulk_dm"; content: string; student_ids: number[] }
  ) => Promise<void>;
}) {
  const [messageMode, setMessageMode] = useState<"channel_post" | "bulk_dm">("channel_post");
  const [selectedTemplate, setSelectedTemplate] = useState("custom");
  const [content, setContent] = useState("");
  const [selectedServers, setSelectedServers] = useState<number[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [showBulkSelect, setShowBulkSelect] = useState(false);
  const [localError, setLocalError] = useState("");

  const visibleStudents = useMemo(() => {
    const normalizedSearch = studentSearchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return students;
    }

    return students.filter((student) => student.name.toLowerCase().includes(normalizedSearch));
  }, [students, studentSearchTerm]);

  const studentsMissingDiscord = selectedStudents.filter((studentId) => {
    const student = students.find((item) => item.id === studentId);
    return !student?.discord_username;
  }).length;

  const getStudentsByBulkFilter = (filterId: BulkRecipientFilter) => {
    switch (filterId) {
      case "debt":
        return students.filter((student) => student.has_debt);
      case "incomplete_topic":
        return students.filter((student) => student.has_incomplete_topic);
      case "recent_absence":
        return students.filter((student) => student.absent_in_recent_session);
      default:
        return [];
    }
  };

  const toggleServer = (serverId: number) => {
    setSelectedServers((current) => (
      current.includes(serverId) ? current.filter((id) => id !== serverId) : [...current, serverId]
    ));
  };

  const toggleStudent = (studentId: number) => {
    setSelectedStudents((current) => (
      current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]
    ));
  };

  const selectClass = (classId: number) => {
    const classStudents = students
      .filter((student) => student.class_id === classId)
      .map((student) => student.id);
    setSelectedStudents(classStudents);
  };

  const selectStudentsByBulkFilter = (filterId: BulkRecipientFilter) => {
    const nextStudentIds = getStudentsByBulkFilter(filterId).map((student) => student.id);
    setSelectedStudents((current) => Array.from(new Set([...current, ...nextStudentIds])));
    setShowBulkSelect(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError("");

    if (!content.trim()) {
      setLocalError("Nội dung tin nhắn là bắt buộc");
      return;
    }

    if (messageMode === "channel_post") {
      if (selectedServers.length === 0) {
        setLocalError("Vui lòng chọn ít nhất một server");
        return;
      }

      await onSubmit({ type: "channel_post", content: content.trim(), server_ids: selectedServers });
      return;
    }

    if (selectedStudents.length === 0) {
      setLocalError("Vui lòng chọn ít nhất một học sinh");
      return;
    }

    await onSubmit({ type: "bulk_dm", content: content.trim(), student_ids: selectedStudents });
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div>
        <label className="mb-2 block text-sm text-zinc-700">Loại tin nhắn</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMessageMode("channel_post")}
            className={`flex-1 rounded-lg px-4 py-3 font-medium transition-colors ${
              messageMode === "channel_post" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            Gửi vào channel
          </button>
          <button
            type="button"
            onClick={() => setMessageMode("bulk_dm")}
            className={`flex-1 rounded-lg px-4 py-3 font-medium transition-colors ${
              messageMode === "bulk_dm" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            Tin nhắn riêng (Bulk DM)
          </button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-700">Mẫu tin nhắn</label>
        <select
          value={selectedTemplate}
          onChange={(event) => {
            setSelectedTemplate(event.target.value);
            const template = MESSAGE_TEMPLATES.find((item) => item.id === event.target.value);
            if (template) {
              setContent(template.content);
            }
          }}
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          {MESSAGE_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>{template.label}</option>
          ))}
        </select>
      </div>

      {messageMode === "channel_post" ? (
        <div>
          <label className="mb-2 block text-sm text-zinc-700">
            Chọn server ({selectedServers.length} đã chọn)
          </label>
          {servers.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              {servers.map((server) => (
                <label
                  key={server.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 hover:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedServers.includes(server.id)}
                    onChange={() => toggleServer(server.id)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{server.name}</p>
                    <p className="flex items-center gap-1 text-xs text-zinc-600">
                      <Hash className="h-3 w-3" />
                      {server.binding.notification_channel_name || server.binding.notification_channel_id}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center">
              <AlertCircle className="mx-auto mb-2 h-8 w-8 text-zinc-400" />
              <p className="text-sm text-zinc-600">Chưa có server nào cấu hình channel thông báo</p>
              <p className="mt-1 text-xs text-zinc-500">Vui lòng cấu hình channel trong tab Cấu hình</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="block text-sm text-zinc-700">
              Chọn người nhận ({selectedStudents.length}/{students.length} học sinh)
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              {classes.map((cls) => (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => selectClass(cls.id)}
                  className="rounded bg-zinc-100 px-3 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-200"
                >
                  {cls.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={studentSearchTerm}
                onChange={(event) => setStudentSearchTerm(event.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                placeholder="Nhập tên học sinh..."
              />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowBulkSelect((current) => !current)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                title="Chọn hàng loạt"
                aria-label="Chọn hàng loạt"
              >
                <ListChecks className="h-4 w-4" />
              </button>
              {showBulkSelect && (
                <div className="absolute right-0 z-10 mt-2 w-72 rounded-lg border border-zinc-200 bg-white p-2 shadow-xl">
                  {BULK_RECIPIENT_FILTERS.map((filter) => {
                    const FilterIcon = filter.icon;
                    const count = getStudentsByBulkFilter(filter.id).length;

                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => selectStudentsByBulkFilter(filter.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                      >
                        <span className="flex items-center gap-2">
                          <FilterIcon className="h-4 w-4 text-zinc-500" />
                          {filter.label}
                        </span>
                        <span className="text-xs text-zinc-500">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedStudents([])}
              disabled={selectedStudents.length === 0}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
              title="Bỏ chọn tất cả"
              aria-label="Bỏ chọn tất cả"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50">
            {visibleStudents.map((student) => {
              const className = classes.find((cls) => cls.id === student.class_id)?.name;

              return (
                <label
                  key={student.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-zinc-200 px-4 py-3 last:border-b-0 hover:bg-zinc-100"
                >
                  <input
                    type="checkbox"
                    checked={selectedStudents.includes(student.id)}
                    onChange={() => toggleStudent(student.id)}
                    className="h-4 w-4"
                  />
                  <div className="flex-1">
                    <p className="text-sm text-zinc-900">{student.name}</p>
                    <p className="text-xs text-zinc-600">{className ?? "Chưa có lớp"}</p>
                  </div>
                  {!student.discord_username && (
                    <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600">Thiếu username</span>
                  )}
                </label>
              );
            })}
            {visibleStudents.length === 0 && (
              <p className="px-4 py-3 text-sm text-zinc-500">Không có học sinh trong bộ lọc hiện tại.</p>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm text-zinc-700">Nội dung tin nhắn</label>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={8}
          className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          placeholder="Nhập nội dung tin nhắn..."
        />
      </div>

      {messageMode === "channel_post" && selectedServers.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 p-4">
          <p className="text-sm text-zinc-700">Tin nhắn sẽ được gửi vào channel của {selectedServers.length} server.</p>
        </div>
      )}

      {messageMode === "bulk_dm" && selectedStudents.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 p-4">
          <p className="mb-2 text-sm text-zinc-700">Tin nhắn sẽ được gửi riêng cho {selectedStudents.length} học sinh.</p>
          {studentsMissingDiscord > 0 && (
            <p className="text-xs text-zinc-600">
              {studentsMissingDiscord} học sinh chưa có Discord username, tin nhắn có thể không gửi được cho các học sinh này.
            </p>
          )}
        </div>
      )}

      {localError && <p className="text-sm text-red-600">{localError}</p>}

      <button
        type="submit"
        disabled={submitting || !content.trim() || (messageMode === "channel_post" ? selectedServers.length === 0 : selectedStudents.length === 0)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-5 w-5" />
        {submitting ? "Đang gửi..." : "Gửi tin nhắn"}
      </button>
    </form>
  );
}

function SyncServersModal({
  submitting,
  onClose,
  onSubmit,
}: {
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="mb-6 text-xl font-semibold text-zinc-900">Đồng bộ server Discord</h2>
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="mb-3 text-sm text-zinc-700">
              Hệ thống sẽ lấy danh sách Discord server mà bot đã được thêm vào.
            </p>
            <p className="text-xs text-zinc-600">Đảm bảo bot đã ở trong server Discord trước khi đồng bộ.</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg bg-zinc-100 px-4 py-3 text-zinc-900 transition-colors hover:bg-zinc-200"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => { void onSubmit(); }}
              disabled={submitting}
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
            >
              {submitting ? "Đang đồng bộ..." : "Đồng bộ ngay"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServerModal({
  title,
  classes,
  servers,
  initialValues,
  submitting,
  onClose,
  onSubmit,
}: {
  title: string;
  classes: ClassOption[];
  servers: BackendDiscordServer[];
  initialValues?: {
    class_id: number;
    discord_server_id: string;
    attendance_voice_channel_id: string;
    notification_channel_id: string;
  };
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    class_id: number;
    server_id: number;
    attendance_voice_channel_id?: string | null;
    notification_channel_id?: string | null;
  }) => Promise<void>;
}) {
  const initialServer = initialValues?.discord_server_id
    ? servers.find((server) => server.discord_server_id === initialValues.discord_server_id)
    : undefined;
  const availableServers = useMemo(
    () => servers.filter((server) => {
      if (initialServer && server.id === initialServer.id) {
        return true;
      }

      return server.binding.role === "unbound";
    }),
    [initialServer, servers],
  );
  const [classId, setClassId] = useState(initialValues?.class_id ? String(initialValues.class_id) : "");
  const [serverId, setServerId] = useState(initialServer ? String(initialServer.id) : "");
  const [voiceChannelId, setVoiceChannelId] = useState(initialValues?.attendance_voice_channel_id ?? "");
  const [textChannelId, setTextChannelId] = useState(initialValues?.notification_channel_id ?? "");
  const [channels, setChannels] = useState<BackendDiscordChannel[]>([]);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!serverId) {
      setChannels([]);
      return;
    }

    let cancelled = false;
    void listDiscordChannels(Number(serverId)).then((nextChannels) => {
      if (!cancelled) {
        setChannels(nextChannels);
      }
    }).catch(() => {
      if (!cancelled) {
        setChannels([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [serverId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError("");

    const parsedClassId = Number(classId);
    if (!Number.isInteger(parsedClassId) || parsedClassId <= 0) {
      setLocalError("Vui lòng chọn lớp hợp lệ");
      return;
    }

    const parsedServerId = Number(serverId);
    if (!Number.isInteger(parsedServerId) || parsedServerId <= 0) {
      setLocalError("Vui lòng chọn server hợp lệ");
      return;
    }

    await onSubmit({
      class_id: parsedClassId,
      server_id: parsedServerId,
      attendance_voice_channel_id: voiceChannelId.trim() || null,
      notification_channel_id: textChannelId.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="mb-6 text-xl font-semibold text-zinc-900">{title}</h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm text-zinc-700">Lớp liên kết</label>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">Chọn lớp</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-700">Discord server</label>
            <select
              value={serverId}
              onChange={(event) => setServerId(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">Chọn server đã đồng bộ</option>
              {availableServers.map((server) => (
                <option key={server.id} value={server.id}>{server.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-700">Channel thông báo</label>
            <select
              value={textChannelId}
              onChange={(event) => setTextChannelId(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">Chọn text channel</option>
              {channels.filter((channel) => channel.type === "text").map((channel) => (
                <option key={channel.id} value={channel.id}>{channel.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-700">Voice channel</label>
            <select
              value={voiceChannelId}
              onChange={(event) => setVoiceChannelId(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">Chọn voice channel</option>
              {channels.filter((channel) => channel.type === "voice").map((channel) => (
                <option key={channel.id} value={channel.id}>{channel.name}</option>
              ))}
            </select>
          </div>

          {localError && <p className="text-sm text-red-600">{localError}</p>}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg bg-zinc-100 px-4 py-3 text-zinc-900 transition-colors hover:bg-zinc-200"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
            >
              {submitting ? "Đang lưu..." : "Lưu cấu hình"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
