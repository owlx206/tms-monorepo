import { useState } from "react";
import { Navigate, Outlet, Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardList,
  DollarSign,
  BookOpen,
  LogOut,
  MessageSquare,
  Shield,
  UserCircle,
  BadgeCheck,
  ChevronDown,
  KeyRound,
} from "lucide-react";

import { ApiError } from "../services/apiClient";
import { updateMe } from "../services/authService";
import { clearAuthSession, getAccessToken, getStoredTeacher, setStoredTeacher } from "../services/authStorage";

type NavItem = {
  path: string;
  icon: typeof LayoutDashboard;
  label: string;
};

const teacherNavItems: NavItem[] = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/students", icon: Users, label: "Học sinh" },
  { path: "/classes", icon: GraduationCap, label: "Lớp học" },
  { path: "/sessions", icon: ClipboardList, label: "Buổi học" },
  { path: "/topics", icon: BookOpen, label: "Chuyên đề" },
  { path: "/messaging", icon: MessageSquare, label: "Discord" },
  { path: "/transactions", icon: DollarSign, label: "Tài chính" },
];

const sysAdminNavItems: NavItem[] = [
  { path: "/admin/teachers", icon: Shield, label: "Quản trị tài khoản" },
];

function isNavItemActive(currentPath: string, itemPath: string): boolean {
  if (currentPath === itemPath) {
    return true;
  }

  return currentPath.startsWith(`${itemPath}/`);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Đã có lỗi xảy ra";
}

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const accessToken = getAccessToken();
  const teacher = getStoredTeacher();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  if (!accessToken || !teacher || !teacher.is_active) {
    clearAuthSession();
    return <Navigate to="/login" replace />;
  }

  const navItems = teacher.role === "sysadmin" ? sysAdminNavItems : teacherNavItems;

  const handleLogout = () => {
    clearAuthSession();
    navigate("/login");
  };

  const handlePasswordChange = async (password: string) => {
    setSavingPassword(true);
    setPasswordError("");

    try {
      const updated = await updateMe({ password });
      setStoredTeacher(updated);
      setShowPasswordModal(false);
    } catch (error) {
      setPasswordError(toErrorMessage(error));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900">
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-semibold text-white">CP Training</h1>
          </div>
          <div className="relative mt-4">
            <button
              type="button"
              onClick={() => setAccountMenuOpen((open) => !open)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-3 text-left transition-colors hover:bg-zinc-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm text-white">
                    <UserCircle className="h-4 w-4 text-zinc-400" />
                    <span className="font-medium">{teacher.username}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                    <BadgeCheck className="h-4 w-4" />
                    <span>{teacher.role === "sysadmin" ? "Admin" : "Teacher"}</span>
                  </div>
                </div>
                <ChevronDown className={`mt-1 h-4 w-4 text-zinc-400 transition-transform ${accountMenuOpen ? "rotate-180" : ""}`} />
              </div>
            </button>

            {accountMenuOpen && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordError("");
                    setShowPasswordModal(true);
                    setAccountMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>Đổi mật khẩu</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(location.pathname, item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  active
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {showPasswordModal && (
        <PasswordChangeModal
          error={passwordError}
          submitting={savingPassword}
          onClose={() => {
            if (savingPassword) {
              return;
            }
            setPasswordError("");
            setShowPasswordModal(false);
          }}
          onSubmit={handlePasswordChange}
        />
      )}
    </div>
  );
}

function PasswordChangeModal({
  error,
  submitting,
  onClose,
  onSubmit,
}: {
  error: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError("");

    if (!password.trim()) {
      setLocalError("Mật khẩu mới không được để trống");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Mật khẩu xác nhận không khớp");
      return;
    }

    await onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="mb-6 text-xl font-semibold text-zinc-900">Đổi mật khẩu</h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm text-zinc-700">Mật khẩu mới</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-700">Xác nhận mật khẩu</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              autoComplete="new-password"
            />
          </div>

          {(localError || error) && (
            <p className="text-sm text-red-600">{localError || error}</p>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg bg-zinc-100 px-4 py-3 text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-60"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
            >
              {submitting ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
