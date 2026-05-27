import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, KeyRound, Settings, TriangleAlert, UserCheck, UserX } from "lucide-react";

import { ApiError } from "../services/apiClient";
import {
  getDiscordBotCredential,
  listTeacherAccounts,
  upsertDiscordBotCredential,
  updateTeacherAccount,
  type BackendTeacherAccount,
  type BackendDiscordBotCredential,
} from "../services/adminService";
import { getMe, type AuthTeacher, updateMe } from "../services/authService";
import { setStoredTeacher } from "../services/authStorage";
import { formatVietnamDate, formatVietnamDateTime } from "../services/vietnamTime";

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Đã có lỗi xảy ra";
}

function formatDate(dateString: string): string {
  return formatVietnamDate(dateString);
}

function formatDateTime(dateString: string): string {
  return formatVietnamDateTime(dateString);
}

function DiscordBotHealthBadge({ credential }: { credential: BackendDiscordBotCredential | null }) {
  if (!credential?.has_bot_token) {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
        <Clock3 className="h-4 w-4" />
        Chưa có bot token
      </span>
    );
  }

  if (credential.bot_health_status === "healthy") {
    return (
      <span
        title={credential.bot_health_checked_at ? `Kiểm tra lúc ${formatDateTime(credential.bot_health_checked_at)}` : undefined}
        className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
      >
        <CheckCircle2 className="h-4 w-4" />
        Bot token ổn
      </span>
    );
  }

  if (credential.bot_health_status === "unhealthy") {
    return (
      <span
        title={credential.bot_health_message ?? undefined}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        <TriangleAlert className="h-4 w-4" />
        Bot token lỗi
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
      <Clock3 className="h-4 w-4" />
      Chưa kiểm tra bot token
    </span>
  );
}

export function TeacherAccounts() {
  const [teachers, setTeachers] = useState<BackendTeacherAccount[]>([]);
  const [account, setAccount] = useState<AuthTeacher | null>(null);
  const [showResetModalFor, setShowResetModalFor] = useState<BackendTeacherAccount | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showDiscordBotModal, setShowDiscordBotModal] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingTeacherId, setUpdatingTeacherId] = useState<number | null>(null);
  const [discordBotCredential, setDiscordBotCredential] = useState<BackendDiscordBotCredential | null>(null);

  const loadData = async (): Promise<void> => {
    setLoading(true);
    setRequestError("");

    try {
      const [teacherList, me] = await Promise.all([
        listTeacherAccounts(),
        getMe(),
      ]);

      setTeachers(teacherList);
      setAccount(me);
      setStoredTeacher(me);
      const credential = await getDiscordBotCredential();
      setDiscordBotCredential(credential);
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const stats = useMemo(() => {
    const total = teachers.length;
    const active = teachers.filter((teacher) => teacher.is_active).length;

    return { total, active };
  }, [teachers]);

  const handleToggleActive = async (teacher: BackendTeacherAccount) => {
    setUpdatingTeacherId(teacher.id);
    setRequestError("");

    try {
      await updateTeacherAccount(teacher.id, {
        is_active: !teacher.is_active,
      });
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setUpdatingTeacherId(null);
    }
  };

  const handleResetPassword = async (teacherId: number, password: string) => {
    setUpdatingTeacherId(teacherId);
    setRequestError("");

    try {
      await updateTeacherAccount(teacherId, { password });
      setShowResetModalFor(null);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setUpdatingTeacherId(null);
    }
  };

  const handleUpdateMyAccount = async (payload: {
    username?: string;
    password?: string;
    codeforces_handle?: string | null;
    codeforces_api_key?: string | null;
    codeforces_api_secret?: string | null;
  }) => {
    setSubmitting(true);
    setRequestError("");

    try {
      const updated = await updateMe(payload);
      setAccount(updated);
      setStoredTeacher(updated);
      setShowAccountModal(false);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDiscordBotCredential = async (payload: {
    bot_token: string;
    client_id: string;
    client_secret: string;
    permissions?: string | null;
    scopes?: string | null;
  }) => {
    setSubmitting(true);
    setRequestError("");

    try {
      const saved = await upsertDiscordBotCredential(payload);
      setDiscordBotCredential(saved);
      setShowDiscordBotModal(false);
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
          <h1 className="text-3xl font-semibold text-zinc-900 mb-2">Quản trị tài khoản</h1>
          <p className="text-zinc-600">System admin quản lý tài khoản đăng nhập của giáo viên</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAccountModal(true)}
            className="flex items-center gap-2 px-4 py-3 bg-zinc-100 text-zinc-700 rounded-lg font-medium hover:bg-zinc-200 transition-colors"
          >
            <Settings className="w-5 h-5" />
            Tài khoản của tôi
          </button>
        </div>
      </div>

      {requestError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {requestError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
          <p className="text-sm text-zinc-600 mb-2">Tổng tài khoản</p>
          <p className="text-3xl font-semibold text-zinc-900">{loading ? "..." : stats.total}</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
          <p className="text-sm text-zinc-600 mb-2">Đang hoạt động</p>
          <p className="text-3xl font-semibold text-zinc-900">{loading ? "..." : stats.active}</p>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-zinc-900">Discord bot của hệ thống</h2>
              <DiscordBotHealthBadge credential={discordBotCredential} />
            </div>
            <p className="mt-1 text-sm text-zinc-600">
              Credential của bot được cấu hình một lần ở đây. Giáo viên chỉ nhận invite link và chọn server/channel đã đồng bộ.
            </p>
            <div className="mt-4 space-y-1 text-sm text-zinc-700">
              <p>Bot token: {discordBotCredential?.has_bot_token ? "đã cấu hình" : "chưa cấu hình"}</p>
              <p>
                Health: {discordBotCredential?.bot_health_status ?? "unknown"}
                {discordBotCredential?.bot_health_checked_at ? `, ${formatDateTime(discordBotCredential.bot_health_checked_at)}` : ""}
              </p>
              {discordBotCredential?.bot_health_message && (
                <p>Health detail: {discordBotCredential.bot_health_message}</p>
              )}
              <p>Client secret: {discordBotCredential?.has_client_secret ? "đã cấu hình" : "chưa cấu hình"}</p>
              <p>Client ID: {discordBotCredential?.client_id || "chưa cấu hình"}</p>
              <p>Invite link: {discordBotCredential?.invite_link || "chưa có"}</p>
              <p>Teacher verification redirect URI: {discordBotCredential?.verification_redirect_uri || "chưa có"}</p>
              <p>Bot install redirect URI: {discordBotCredential?.install_redirect_uri || "chưa có"}</p>
              <p>Student authorization redirect URI: {discordBotCredential?.student_authorization_redirect_uri || "chưa có"}</p>
            </div>
          </div>
          <button
            onClick={() => setShowDiscordBotModal(true)}
            className="rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Cấu hình bot
          </button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">Danh sách tài khoản</h2>

        <div className="space-y-4">
          {teachers.map((teacher) => {
            const isCurrentUser = account?.id === teacher.id;
            const isRowLoading = updatingTeacherId === teacher.id;

            return (
              <div
                key={teacher.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-zinc-900 font-semibold">{teacher.username}</p>
                      {teacher.role === "admin" ? (
                        <span className="px-3 py-1 rounded-full text-xs bg-zinc-900 text-white">Admin</span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs bg-zinc-200 text-zinc-700">Teacher</span>
                      )}
                      {teacher.is_active ? (
                        <span className="px-3 py-1 rounded-full text-xs bg-zinc-200 text-zinc-700">Active</span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs bg-zinc-300 text-zinc-800">Inactive</span>
                      )}
                      {isCurrentUser && (
                        <span className="px-3 py-1 rounded-full text-xs bg-zinc-100 text-zinc-600">Bạn</span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-zinc-600 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Tạo ngày: {formatDate(teacher.created_at)}</span>
                      <span>Codeforces: {teacher.codeforces_handle ?? "Chưa cập nhật"}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={isRowLoading || (isCurrentUser && teacher.is_active)}
                      onClick={() => void handleToggleActive(teacher)}
                      className="px-3 py-2 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors text-sm disabled:opacity-50"
                    >
                      {teacher.is_active ? (
                        <>
                          <UserX className="w-4 h-4 inline mr-2" />
                          Khóa tài khoản
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4 inline mr-2" />
                          Mở lại tài khoản
                        </>
                      )}
                    </button>
                    <button
                      disabled={isRowLoading}
                      onClick={() => setShowResetModalFor(teacher)}
                      className="px-3 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors text-sm disabled:opacity-50"
                    >
                      <KeyRound className="w-4 h-4 inline mr-2" />
                      Đặt mật khẩu
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && teachers.length === 0 && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-10 text-center text-zinc-600">
              Chưa có tài khoản nào
            </div>
          )}
        </div>
      </div>

      {showResetModalFor && (
        <ResetPasswordModal
          teacher={showResetModalFor}
          submitting={updatingTeacherId === showResetModalFor.id}
          onClose={() => setShowResetModalFor(null)}
          onSubmit={handleResetPassword}
        />
      )}

      {showAccountModal && account && (
        <AccountSettingsModal
          account={account}
          submitting={submitting}
          onClose={() => setShowAccountModal(false)}
          onSubmit={handleUpdateMyAccount}
        />
      )}

      {showDiscordBotModal && (
        <DiscordBotCredentialModal
          credential={discordBotCredential}
          submitting={submitting}
          onClose={() => setShowDiscordBotModal(false)}
          onSubmit={handleSaveDiscordBotCredential}
        />
      )}

    </div>
  );
}

function DiscordBotCredentialModal({
  credential,
  submitting,
  onClose,
  onSubmit,
}: {
  credential: BackendDiscordBotCredential | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    bot_token: string;
    client_id: string;
    client_secret: string;
    permissions?: string | null;
    scopes?: string | null;
  }) => Promise<void>;
}) {
  const [botToken, setBotToken] = useState("");
  const [clientId, setClientId] = useState(credential?.client_id ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [permissions, setPermissions] = useState(credential?.permissions ?? "");
  const [scopes, setScopes] = useState(credential?.scopes ?? "bot applications.commands");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError("");

    if (!clientId.trim()) {
      setLocalError("Client ID là bắt buộc");
      return;
    }

    if (!credential?.has_bot_token && !botToken.trim()) {
      setLocalError("Bot token là bắt buộc ở lần cấu hình đầu");
      return;
    }

    if (!credential?.has_client_secret && !clientSecret.trim()) {
      setLocalError("Client secret là bắt buộc ở lần cấu hình đầu");
      return;
    }

    await onSubmit({
      bot_token: botToken.trim() || "__KEEP_EXISTING__",
      client_id: clientId.trim(),
      client_secret: clientSecret.trim() || "__KEEP_EXISTING__",
      permissions: permissions.trim() || null,
      scopes: scopes.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="mb-6 text-xl font-semibold text-zinc-900">Cấu hình Discord bot</h2>
        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          <p className="font-medium text-zinc-900">OAuth redirect URI cần add trong Discord Developer Portal</p>
          <div className="mt-1 space-y-1 break-all">
            <p>{credential?.verification_redirect_uri ?? "https://saas.owlab.uk/api/discord/verification/callback"}</p>
            <p>{credential?.install_redirect_uri ?? "https://saas.owlab.uk/api/discord/oauth/callback"}</p>
            <p>{credential?.student_authorization_redirect_uri ?? "https://saas.owlab.uk/api/discord/student/callback"}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-zinc-700">Bot token</label>
            <input
              type="password"
              value={botToken}
              onChange={(event) => setBotToken(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder={credential?.has_bot_token ? "Để trống nếu giữ token hiện tại" : "Nhập bot token"}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-zinc-700">Client ID</label>
            <input
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-zinc-700">Client secret</label>
            <input
              type="password"
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder={credential?.has_client_secret ? "Để trống nếu giữ client secret hiện tại" : "Nhập client secret"}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-zinc-700">Permissions</label>
            <input
              value={permissions}
              onChange={(event) => setPermissions(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="8"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-zinc-700">Scopes</label>
            <input
              value={scopes}
              onChange={(event) => setScopes(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>
          {localError && <p className="text-sm text-red-600">{localError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-zinc-100 px-4 py-3 text-zinc-900 hover:bg-zinc-200">
              Hủy
            </button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-zinc-900 px-4 py-3 text-white hover:bg-zinc-800 disabled:opacity-60">
              {submitting ? "Đang lưu..." : "Lưu bot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({
  teacher,
  submitting,
  onClose,
  onSubmit,
}: {
  teacher: BackendTeacherAccount;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (teacherId: number, password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError("");

    if (!password.trim()) {
      setLocalError("Mật khẩu mới không được để trống");
      return;
    }

    await onSubmit(teacher.id, password);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-zinc-200 rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">Đặt lại mật khẩu</h2>
        <p className="text-zinc-600 text-sm mb-6">Tài khoản: {teacher.username}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-700 mb-2">Mật khẩu mới</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          {localError && <p className="text-sm text-red-600">{localError}</p>}

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
              className="flex-1 px-4 py-3 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-60"
            >
              {submitting ? "Đang lưu..." : "Lưu mật khẩu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AccountSettingsModal({
  account,
  submitting,
  onClose,
  onSubmit,
}: {
  account: AuthTeacher;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    username?: string;
    password?: string;
    codeforces_handle?: string | null;
    codeforces_api_key?: string | null;
    codeforces_api_secret?: string | null;
  }) => Promise<void>;
}) {
  const [username, setUsername] = useState(account.username);
  const [password, setPassword] = useState("");
  const [codeforcesHandle, setCodeforcesHandle] = useState(account.codeforces_handle ?? "");
  const [codeforcesApiKey, setCodeforcesApiKey] = useState(account.codeforces_api_key ?? "");
  const [codeforcesApiSecret, setCodeforcesApiSecret] = useState(account.codeforces_api_secret ?? "");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError("");

    const payload: {
      username?: string;
      password?: string;
      codeforces_handle?: string | null;
      codeforces_api_key?: string | null;
      codeforces_api_secret?: string | null;
    } = {};

    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      setLocalError("Username không được để trống");
      return;
    }

    if (normalizedUsername !== account.username) {
      payload.username = normalizedUsername;
    }

    if (password.trim().length > 0) {
      payload.password = password;
    }

    if (codeforcesHandle.trim() !== (account.codeforces_handle ?? "")) {
      payload.codeforces_handle = codeforcesHandle.trim() || null;
    }

    if (codeforcesApiKey.trim() !== (account.codeforces_api_key ?? "")) {
      payload.codeforces_api_key = codeforcesApiKey.trim() || null;
    }

    if (codeforcesApiSecret.trim() !== (account.codeforces_api_secret ?? "")) {
      payload.codeforces_api_secret = codeforcesApiSecret.trim() || null;
    }

    if (Object.keys(payload).length === 0) {
      setLocalError("Không có thay đổi nào để lưu");
      return;
    }

    await onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-zinc-200 rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-semibold text-zinc-900 mb-6">Cập nhật tài khoản</h2>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm text-zinc-700 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-700 mb-2">Mật khẩu mới (optional)</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="Để trống nếu không đổi"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-700 mb-2">Codeforces owner handle</label>
            <input
              type="text"
              value={codeforcesHandle}
              onChange={(event) => setCodeforcesHandle(event.target.value)}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="tourist"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-700 mb-2">Codeforces API Key (optional)</label>
            <input
              type="text"
              value={codeforcesApiKey}
              onChange={(event) => setCodeforcesApiKey(event.target.value)}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-700 mb-2">Codeforces API Secret (optional)</label>
            <input
              type="password"
              value={codeforcesApiSecret}
              onChange={(event) => setCodeforcesApiSecret(event.target.value)}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          {localError && <p className="text-sm text-red-600">{localError}</p>}

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
              {submitting ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
