import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Bot, CheckCircle2, KeyRound, Link2, Server, UserCircle, XCircle } from "lucide-react";

import { ApiError } from "../services/apiClient";
import {
  getDiscordVerificationAuthorizeUrl,
  getMe,
  updateMe,
  type AuthTeacher,
} from "../services/authService";
import { setStoredTeacher } from "../services/authStorage";
import {
  getDiscordBotInviteLink,
  listDiscordGuilds,
  type BackendClassDiscordBinding,
} from "../services/discordService";

type DiscordInstallMessage = {
  type: "discord-install-result";
  status: string;
};

type DiscordVerificationMessage = {
  type: "discord-verification-result";
  status: string;
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

export function Settings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const discordInstallPopupRef = useRef<Window | null>(null);
  const discordVerificationPopupRef = useRef<Window | null>(null);
  const [teacher, setTeacher] = useState<AuthTeacher | null>(null);
  const [guilds, setGuilds] = useState<BackendClassDiscordBinding[]>([]);
  const [botInviteLink, setBotInviteLink] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [codeforcesHandle, setCodeforcesHandle] = useState("");
  const [codeforcesApiKey, setCodeforcesApiKey] = useState("");
  const [codeforcesApiSecret, setCodeforcesApiSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCodeforces, setSavingCodeforces] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestMessage, setRequestMessage] = useState("");

  const loadData = async () => {
    setLoading(true);
    setRequestError("");

    try {
      const [currentTeacher, currentGuilds, inviteLink] = await Promise.all([
        getMe(),
        listDiscordGuilds(),
        getDiscordBotInviteLink(),
      ]);
      setTeacher(currentTeacher);
      setStoredTeacher(currentTeacher);
      setUsername(currentTeacher.username);
      setCodeforcesHandle(currentTeacher.codeforces_handle ?? "");
      setCodeforcesApiKey(currentTeacher.codeforces_api_key ?? "");
      setCodeforcesApiSecret(currentTeacher.codeforces_api_secret ?? "");
      setGuilds(currentGuilds);
      setBotInviteLink(inviteLink);
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const handleDiscordMessage = (event: MessageEvent<DiscordInstallMessage | DiscordVerificationMessage>) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === "discord-install-result") {
        handleDiscordInstallStatus(event.data.status);
        discordInstallPopupRef.current?.close();
        discordInstallPopupRef.current = null;
      }

      if (event.data?.type === "discord-verification-result") {
        handleDiscordVerificationStatus(event.data.status);
        discordVerificationPopupRef.current?.close();
        discordVerificationPopupRef.current = null;
      }
    };

    window.addEventListener("message", handleDiscordMessage);
    return () => window.removeEventListener("message", handleDiscordMessage);
  }, []);

  useEffect(() => {
    const installStatus = searchParams.get("discord_install");
    const verificationStatus = searchParams.get("discord_verification");
    if (!installStatus && !verificationStatus) {
      return;
    }

    if (installStatus) {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: "discord-install-result", status: installStatus } satisfies DiscordInstallMessage,
          window.location.origin,
        );
        window.close();
        return;
      }

      handleDiscordInstallStatus(installStatus);
    }

    if (verificationStatus) {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: "discord-verification-result", status: verificationStatus } satisfies DiscordVerificationMessage,
          window.location.origin,
        );
        window.close();
        return;
      }

      handleDiscordVerificationStatus(verificationStatus);
    }

    navigate("/settings", { replace: true });
  }, [navigate, searchParams]);

  const handleDiscordInstallStatus = (installStatus: string) => {
    if (installStatus === "success") {
      setRequestError("");
      setRequestMessage("Đã ghi nhận server Discord. Dữ liệu server sẽ xuất hiện sau lượt đồng bộ kế tiếp.");
      void loadData();
    } else if (installStatus === "conflict") {
      setRequestMessage("");
      setRequestError("Server Discord này đã được liên kết với giáo viên khác.");
    } else if (installStatus === "cancelled") {
      setRequestMessage("");
      setRequestError("Bạn đã hủy thao tác thêm bot vào Discord guild.");
    } else if (installStatus === "invalid_state" || installStatus === "invalid_callback") {
      setRequestMessage("");
      setRequestError("Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.");
    }
  };

  const handleDiscordVerificationStatus = (verificationStatus: string) => {
    if (verificationStatus === "success") {
      setRequestError("");
      setRequestMessage("Đã xác thực tài khoản Discord.");
      void loadData();
    } else if (verificationStatus === "cancelled") {
      setRequestMessage("");
      setRequestError("Bạn đã hủy xác thực Discord.");
    } else {
      setRequestMessage("");
      setRequestError("Không xác thực được Discord. Vui lòng thử lại.");
    }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setRequestError("");
    setRequestMessage("");

    try {
      const payload: { username?: string; password?: string } = {};
      if (username.trim() && username.trim() !== teacher?.username) {
        payload.username = username.trim();
      }
      if (password.trim()) {
        payload.password = password;
      }
      const updated = Object.keys(payload).length > 0 ? await updateMe(payload) : teacher;
      if (updated) {
        setTeacher(updated);
        setStoredTeacher(updated);
        setPassword("");
      }
      setRequestMessage("Đã lưu hồ sơ.");
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  };

  const saveCodeforces = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingCodeforces(true);
    setRequestError("");
    setRequestMessage("");

    try {
      const updated = await updateMe({
        codeforces_handle: codeforcesHandle.trim() || null,
        codeforces_api_key: codeforcesApiKey.trim() || null,
        codeforces_api_secret: codeforcesApiSecret.trim() || null,
      });
      setTeacher(updated);
      setStoredTeacher(updated);
      setRequestMessage("Đã lưu Codeforces credentials.");
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSavingCodeforces(false);
    }
  };

  const startDiscordVerification = async () => {
    setRequestError("");
    setRequestMessage("");
    try {
      const authorizeUrl = await getDiscordVerificationAuthorizeUrl();
      const width = 560;
      const height = 720;
      const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
      const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
      const popup = window.open(
        authorizeUrl,
        "discord-verification",
        `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
      );

      if (!popup) {
        window.location.href = authorizeUrl;
        return;
      }

      discordVerificationPopupRef.current = popup;
      popup.focus();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    }
  };

  const installBot = () => {
    if (!botInviteLink) {
      return;
    }

    setRequestError("");
    setRequestMessage("");

    const width = 560;
    const height = 720;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
    const popup = window.open(
      botInviteLink,
      "discord-bot-install",
      `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
    );

    if (!popup) {
      window.location.href = botInviteLink;
      return;
    }

    discordInstallPopupRef.current = popup;
    popup.focus();
  };

  const discordVerified = Boolean(teacher?.discord_verified_at);
  const canInstallBot = Boolean(botInviteLink && discordVerified);

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Cài đặt</h1>
          <p className="mt-1 text-sm text-zinc-600">Hồ sơ, Codeforces và Discord credentials</p>
        </div>

        {(requestError || requestMessage) && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${requestError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {requestError || requestMessage}
          </div>
        )}

        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-zinc-500" />
            <h2 className="font-semibold text-zinc-900">Hồ sơ</h2>
          </div>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={saveProfile}>
            <label className="text-sm text-zinc-700">
              Tên đăng nhập
              <input value={username} onChange={(event) => setUsername(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900" />
            </label>
            <label className="text-sm text-zinc-700">
              Mật khẩu mới
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900" autoComplete="new-password" />
            </label>
            <div className="md:col-span-2">
              <button type="submit" disabled={savingProfile || loading} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                {savingProfile ? "Đang lưu..." : "Lưu hồ sơ"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-zinc-500" />
            <h2 className="font-semibold text-zinc-900">Codeforces</h2>
          </div>
          <form className="grid gap-4 md:grid-cols-3" onSubmit={saveCodeforces}>
            <label className="text-sm text-zinc-700">
              Handle
              <input value={codeforcesHandle} onChange={(event) => setCodeforcesHandle(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900" />
            </label>
            <label className="text-sm text-zinc-700">
              API key
              <input value={codeforcesApiKey} onChange={(event) => setCodeforcesApiKey(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900" />
            </label>
            <label className="text-sm text-zinc-700">
              API secret
              <input type="password" value={codeforcesApiSecret} onChange={(event) => setCodeforcesApiSecret(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900" />
            </label>
            <div className="md:col-span-3">
              <button type="submit" disabled={savingCodeforces || loading} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                {savingCodeforces ? "Đang lưu..." : "Lưu Codeforces"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bot className="h-5 w-5 text-zinc-500" />
            <h2 className="font-semibold text-zinc-900">Discord</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <StatusRow
              icon={discordVerified ? CheckCircle2 : XCircle}
              label="Tài khoản"
              value={discordVerified ? `@${teacher?.discord_username ?? "Discord"}` : "Chưa xác thực"}
            />
            <StatusRow
              icon={botInviteLink ? CheckCircle2 : XCircle}
              label="Bot"
              value={botInviteLink ? "Đã cấu hình invite" : "Admin chưa cấu hình bot"}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={startDiscordVerification} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50">
              <Link2 className="h-4 w-4" />
              {discordVerified ? "Liên kết lại Discord" : "Xác thực Discord"}
            </button>
            <button type="button" onClick={installBot} disabled={!canInstallBot} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              <Server className="h-4 w-4" />
              Cài bot vào server mới
            </button>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-zinc-700">Servers đã cài bot</h3>
            <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
              {guilds.length === 0 ? (
                <div className="px-4 py-3 text-sm text-zinc-500">Chưa có server Discord.</div>
              ) : guilds.map((guild) => (
                <div key={guild.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium text-zinc-900">{guild.name ?? guild.discord_guild_id}</div>
                    <div className="text-xs text-zinc-500">{guild.name ? guild.discord_guild_id : "Đang đồng bộ metadata"}</div>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                    {guild.binding.role === "class" ? guild.binding.class_name ?? "Đã gắn lớp" : "Chưa gắn lớp"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3">
      <Icon className="h-5 w-5 text-zinc-500" />
      <div>
        <div className="text-xs uppercase text-zinc-500">{label}</div>
        <div className="text-sm font-medium text-zinc-900">{value}</div>
      </div>
    </div>
  );
}
