import { useState } from "react";
import { useNavigate } from "react-router";
import { LogIn } from "lucide-react";

import { ApiError } from "../services/apiClient";
import { login, register as registerAccount } from "../services/authService";
import { getDefaultHomePath, saveAuthSession } from "../services/authStorage";

export function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeforcesHandle, setCodeforcesHandle] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      setError("Vui lòng nhập username và mật khẩu");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setSubmitting(true);

    try {
      const data = mode === "login"
        ? await login({
          username: normalizedUsername,
          password,
        })
        : await registerAccount({
          username: normalizedUsername,
          password,
          codeforces_handle: codeforcesHandle.trim() || null,
        });

      saveAuthSession({
        accessToken: data.accessToken,
        teacher: data.teacher,
      });
      navigate(getDefaultHomePath(data.teacher.role));
    } catch (requestError) {
      setError(
        requestError instanceof ApiError || requestError instanceof Error
          ? requestError.message
          : "Request failed",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-center mb-8">
            <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center">
              <LogIn className="w-6 h-6 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-zinc-900 text-center mb-2">
            {mode === "login" ? "Đăng nhập" : "Đăng ký"}
          </h1>
          <p className="text-zinc-600 text-center mb-8">Hệ thống quản lý lập trình thi đấu</p>

          <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                mode === "register"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Đăng ký
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-700 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                placeholder="Nhập username"
                required
              />
            </div>

            {mode === "register" && (
              <div>
                <label className="block text-sm text-zinc-700 mb-2">Codeforces owner handle (tùy chọn)</label>
                <input
                  type="text"
                  value={codeforcesHandle}
                  onChange={(event) => setCodeforcesHandle(event.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  placeholder="tourist"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-zinc-700 mb-2">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                placeholder="••••••••"
                required
              />
            </div>

            {mode === "register" && (
              <div>
                <label className="block text-sm text-zinc-700 mb-2">Xác nhận mật khẩu</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors disabled:opacity-60"
            >
              {submitting
                ? mode === "login" ? "Đang đăng nhập..." : "Đang đăng ký..."
                : mode === "login" ? "Đăng nhập" : "Đăng ký"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
