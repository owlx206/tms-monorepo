import { useEffect, useMemo, useState } from "react";
import { Users, GraduationCap, DollarSign, TrendingUp, Settings } from "lucide-react";

import { ApiError } from "../services/apiClient";
import { getMe, updateMe, type AuthTeacher } from "../services/authService";
import { setStoredTeacher } from "../services/authStorage";
import { type BackendClass, type BackendClassSchedule, listClassSchedules, listClasses } from "../services/classService";
import { listStudentBalances } from "../services/financeService";
import { getDashboardSummary } from "../services/reportingService";
import { listStudents } from "../services/studentService";

type ActiveClassCard = {
  id: number;
  name: string;
  schedule: string;
  feePerSession: number;
  studentCount: number;
};

type DebtStudent = {
  student_id: number;
  full_name: string;
  balance: number;
  class_name: string;
};

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

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

  const summary = schedules.map((schedule) => {
    const day = DAY_LABELS[schedule.day_of_week] ?? "?";
    const start = schedule.start_time.slice(0, 5);
    const end = schedule.end_time.slice(0, 5);
    return `${day} ${start}-${end}`;
  });

  return Array.from(new Set(summary)).join(", ");
}

async function loadActiveClassCards(
  classes: BackendClass[],
  students: Awaited<ReturnType<typeof listStudents>>,
): Promise<ActiveClassCard[]> {
  const schedules = await Promise.all(classes.map(async (classItem) => ({
    classId: classItem.id,
    schedules: await listClassSchedules(classItem.id),
  })));

  const studentCountByClass = new Map<number, number>();
  students.forEach((student) => {
    if (student.current_class_id === null) {
      return;
    }

    studentCountByClass.set(
      student.current_class_id,
      (studentCountByClass.get(student.current_class_id) ?? 0) + 1,
    );
  });

  const scheduleByClass = new Map<number, string>(
    schedules.map((item) => [item.classId, formatScheduleSummary(item.schedules)]),
  );

  return classes.map((classItem) => ({
    id: classItem.id,
    name: classItem.name,
    schedule: scheduleByClass.get(classItem.id) ?? "Chưa thiết lập",
    feePerSession: parseAmount(classItem.fee_per_session),
    studentCount: studentCountByClass.get(classItem.id) ?? 0,
  }));
}

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState("");
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [account, setAccount] = useState<AuthTeacher | null>(null);
  const [summary, setSummary] = useState<{
    active_students: number;
    active_classes: number;
    total_debt: number;
    monthly_revenue: number;
  } | null>(null);
  const [activeClasses, setActiveClasses] = useState<ActiveClassCard[]>([]);
  const [recentDebts, setRecentDebts] = useState<DebtStudent[]>([]);
  const [savingAccount, setSavingAccount] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setRequestError("");

    try {
      const [dashboardSummary, balances, classes, activeStudents, teacher] = await Promise.all([
        getDashboardSummary(),
        listStudentBalances({
          status: "active",
          include_pending_archive: false,
        }),
        listClasses("active", { readyOnly: true }),
        listStudents({ status: "active" }),
        getMe(),
      ]);

      setAccount(teacher);
      setStoredTeacher(teacher);
      setSummary({
        active_students: dashboardSummary.active_students,
        active_classes: dashboardSummary.active_classes,
        total_debt: parseAmount(dashboardSummary.total_debt),
        monthly_revenue: parseAmount(dashboardSummary.monthly_revenue),
      });

      const classCards = await loadActiveClassCards(classes, activeStudents);
      setActiveClasses(classCards);

      const classNameById = new Map(classCards.map((item) => [item.id, item.name]));
      const classIdByStudentId = new Map<number, number>(
        activeStudents
          .filter((student) => student.current_class_id !== null)
          .map((student) => [student.id, student.current_class_id as number]),
      );
      const debtRows = balances
        .map((balance) => ({
          student_id: balance.student_id,
          full_name: balance.full_name,
          balance: parseAmount(balance.balance),
          class_name: classNameById.get(classIdByStudentId.get(balance.student_id) ?? -1) ?? "N/A",
        }))
        .filter((item) => item.balance < 0)
        .sort((a, b) => a.balance - b.balance)
        .slice(0, 5);
      setRecentDebts(debtRows);
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
    const activeStudents = summary?.active_students ?? 0;
    const activeClassCount = summary?.active_classes ?? 0;
    const totalDebt = summary?.total_debt ?? 0;
    const monthlyRevenue = summary?.monthly_revenue ?? 0;

    return [
      {
        label: "Học sinh đang học",
        value: activeStudents,
        icon: Users,
        color: "bg-zinc-100 text-zinc-700",
      },
      {
        label: "Lớp đang mở",
        value: activeClassCount,
        icon: GraduationCap,
        color: "bg-zinc-100 text-zinc-700",
      },
      {
        label: "Tổng nợ hiện tại",
        value: `${(totalDebt / 1000).toFixed(0)}K`,
        icon: DollarSign,
        color: "bg-zinc-100 text-zinc-700",
      },
      {
        label: "Doanh thu tháng",
        value: `${(monthlyRevenue / 1_000_000).toFixed(1)}M`,
        icon: TrendingUp,
        color: "bg-zinc-100 text-zinc-700",
      },
    ];
  }, [summary]);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 mb-2">Dashboard</h1>
          <p className="text-zinc-600">Tổng quan hệ thống quản lý</p>
        </div>
        <button
          onClick={() => setShowAccountModal(true)}
          className="flex items-center gap-2 px-4 py-3 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors"
        >
          <Settings className="w-5 h-5" />
          Tài khoản
        </button>
      </div>

      {requestError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {requestError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-zinc-600 text-sm mb-2">{stat.label}</p>
                  <p className="text-3xl font-semibold text-zinc-900">{loading ? "..." : stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">Học sinh nợ nhiều nhất</h2>
          <div className="space-y-3">
            {recentDebts.map((student) => (
              <div
                key={student.student_id}
                className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-200"
              >
                <div>
                  <p className="text-zinc-900 font-medium">{student.full_name}</p>
                  <p className="text-sm text-zinc-600">{student.class_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-zinc-700 font-semibold">
                    -{(Math.abs(student.balance) / 1000).toFixed(0)}K
                  </p>
                </div>
              </div>
            ))}
            {!loading && recentDebts.length === 0 && (
              <p className="text-sm text-zinc-500">Không có học sinh đang nợ.</p>
            )}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">Lớp học đang mở</h2>
          <div className="space-y-3">
            {activeClasses.map((cls) => (
              <div
                key={cls.id}
                className="p-4 bg-zinc-50 rounded-lg border border-zinc-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-zinc-900 font-medium">{cls.name}</p>
                  <span className="px-3 py-1 bg-zinc-200 text-zinc-700 rounded-full text-sm">
                    {cls.studentCount} HS
                  </span>
                </div>
                <p className="text-sm text-zinc-600 mb-1">{cls.schedule}</p>
                <p className="text-sm text-zinc-700">
                  {(cls.feePerSession / 1000).toFixed(0)}K/buổi
                </p>
              </div>
            ))}
            {!loading && activeClasses.length === 0 && (
              <p className="text-sm text-zinc-500">Chưa có lớp đang mở.</p>
            )}
          </div>
        </div>
      </div>

      {showAccountModal && account && (
        <AccountSettingsModal
          account={account}
          submitting={savingAccount}
          onClose={() => setShowAccountModal(false)}
          onSubmit={async (payload) => {
            setSavingAccount(true);
            setRequestError("");
            try {
              const updated = await updateMe(payload);
              setAccount(updated);
              setStoredTeacher(updated);
              setShowAccountModal(false);
            } catch (error) {
              setRequestError(toErrorMessage(error));
            } finally {
              setSavingAccount(false);
            }
          }}
        />
      )}
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
  }) => Promise<void>;
}) {
  const [username, setUsername] = useState(account.username);
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError("");

    const payload: {
      username?: string;
      password?: string;
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
