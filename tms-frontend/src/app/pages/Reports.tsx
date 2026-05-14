import { useEffect, useMemo, useState } from "react";
import {
  Download,
  TrendingUp,
  DollarSign,
  Wallet,
  AlertCircle,
} from "lucide-react";

import { ApiError } from "../services/apiClient";
import { listClasses } from "../services/classService";
import {
  listStudentBalances,
  type BackendStudentBalance,
} from "../services/financeService";
import { getIncomeReport } from "../services/reportingService";

type ClassOption = {
  id: number;
  name: string;
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

function parseAmount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyFull(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

function formatMoneyShort(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  }

  return `${(amount / 1_000).toFixed(0)}K`;
}

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>): void {
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getDatePresets(): Array<{ label: string; from: string; to: string }> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);

  const startOfLastMonth = new Date(year, month - 1, 1);
  const endOfLastMonth = new Date(year, month, 0);

  const startOfYear = new Date(year, 0, 1);

  const fmt = (date: Date) => date.toISOString().slice(0, 10);

  return [
    { label: "Tháng này", from: fmt(startOfMonth), to: fmt(endOfMonth) },
    { label: "Tháng trước", from: fmt(startOfLastMonth), to: fmt(endOfLastMonth) },
    { label: "Từ đầu năm", from: fmt(startOfYear), to: fmt(now) },
  ];
}

type DebtStudent = {
  student_id: number;
  full_name: string;
  status: "active" | "pending_archive" | "archived";
  balance: number;
  pending_archive_reason: "needs_collection" | "needs_refund" | null;
};

type ReportStudentStatusFilter = "all" | "active" | "pending_archive" | "archived";

export function Reports({ embedded = false }: { embedded?: boolean }) {
  const presets = getDatePresets();

  const [startDate, setStartDate] = useState(presets[0].from);
  const [endDate, setEndDate] = useState(presets[0].to);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [includeUnpaid, setIncludeUnpaid] = useState(false);
  const [studentStatusFilter, setStudentStatusFilter] = useState<ReportStudentStatusFilter>("all");
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [requestError, setRequestError] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalPayments: 0,
    totalFees: 0,
    totalRefunds: 0,
    netRevenue: 0,
  });
  const [allBalances, setAllBalances] = useState<DebtStudent[]>([]);

  useEffect(() => {
    const loadClasses = async () => {
      try {
        const classes = await listClasses();
        setClassOptions(classes.map((item) => ({ id: item.id, name: item.name })));
      } catch (error) {
        setRequestError(toErrorMessage(error));
      }
    };

    void loadClasses();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    setRequestError("");

    try {
      const classIds = selectedClassId !== "all" ? [Number(selectedClassId)] : undefined;

      const [incomeReport, balances] = await Promise.all([
        getIncomeReport({
          from: `${startDate}T00:00:00.000Z`,
          to: `${endDate}T23:59:59.999Z`,
          class_ids: classIds,
          include_unpaid: includeUnpaid,
        }),
        listStudentBalances({
          status: studentStatusFilter === "all" ? undefined : studentStatusFilter,
          include_pending_archive: true,
        }),
      ]);

      setSummary({
        totalPayments: parseAmount(incomeReport.summary.total_payments),
        totalFees: parseAmount(incomeReport.summary.total_active_fees),
        totalRefunds: parseAmount(incomeReport.summary.total_refunds),
        netRevenue: parseAmount(includeUnpaid ? incomeReport.summary.projected_revenue : incomeReport.summary.net_revenue),
      });

      setAllBalances(
        balances.map((balance: BackendStudentBalance) => ({
          student_id: balance.student_id,
          full_name: balance.full_name,
          status: balance.status,
          balance: parseAmount(balance.balance),
          pending_archive_reason: balance.pending_archive_reason,
        })),
      );
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, [startDate, endDate, selectedClassId, includeUnpaid, studentStatusFilter]);

  const debtStudents = useMemo(
    () => allBalances
      .filter((item) => item.balance < 0)
      .sort((a, b) => a.balance - b.balance),
    [allBalances],
  );

  const totalDebt = useMemo(
    () => debtStudents.reduce((sum, item) => sum + Math.abs(item.balance), 0),
    [debtStudents],
  );

  const handleExport = () => {
    downloadCsv(`bao-cao-${startDate}-${endDate}.csv`, [
      ["Báo cáo tài chính TMS"],
      ["Từ ngày", startDate],
      ["Đến ngày", endDate],
      [],
      ["Chỉ số", "Giá trị (VNĐ)"],
      ["Tổng thu", summary.totalPayments],
      ["Học phí phát sinh", summary.totalFees],
      ["Hoàn trả", summary.totalRefunds],
      ["Tiền ra", summary.totalRefunds],
      ["Lợi nhuận", summary.netRevenue],
      [],
      ["Tổng nợ chưa thu", totalDebt],
      [],
      ["HỌC SINH NỢ"],
      ["Tên", "Trạng thái", "Số nợ (VNĐ)"],
      ...debtStudents.map((s) => [s.full_name, s.status, Math.abs(s.balance)]),
    ]);
  };

  return (
    <div className={embedded ? "" : "p-8"}>
      {!embedded && (
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900 mb-2">Báo cáo tài chính</h1>
            <p className="text-zinc-600">
              {loading ? "Đang tải..." : `${new Date(startDate).toLocaleDateString("vi-VN")} — ${new Date(endDate).toLocaleDateString("vi-VN")}`}
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-3 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors disabled:opacity-60"
          >
            <Download className="w-5 h-5" />
            Xuất CSV
          </button>
        </div>
      )}

      {/* Error */}
      {requestError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {requestError}
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-xl p-6 mb-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Báo cáo tài chính</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {loading ? "Đang tải..." : `${new Date(startDate).toLocaleDateString("vi-VN")} — ${new Date(endDate).toLocaleDateString("vi-VN")}`}
            </p>
          </div>
          {embedded && (
            <button
              onClick={handleExport}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Xuất CSV
            </button>
          )}
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap">
          <div className="flex gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => { setStartDate(preset.from); setEndDate(preset.to); }}
                className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  startDate === preset.from && endDate === preset.to
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
            <span className="text-zinc-400">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          {classOptions.length > 0 && (
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="all">Tất cả lớp</option>
              {classOptions.map((cls) => (
                <option key={cls.id} value={String(cls.id)}>{cls.name}</option>
              ))}
            </select>
          )}

          <select
            value={studentStatusFilter}
            onChange={(e) => setStudentStatusFilter(e.target.value as ReportStudentStatusFilter)}
            className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="all">Tất cả trạng thái học sinh</option>
            <option value="active">Đang học</option>
            <option value="pending_archive">Chờ xử lý</option>
            <option value="archived">Đã archive</option>
          </select>

          <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={includeUnpaid}
              onChange={(event) => setIncludeUnpaid(event.target.checked)}
              className="h-4 w-4"
            />
            Bao gồm khoản chưa thu
          </label>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <SummaryCard
          icon={TrendingUp}
          iconColor="bg-zinc-100 text-zinc-900"
          label="Tiền vào"
          value={formatMoneyShort(summary.totalPayments)}
          detail={formatMoneyFull(summary.totalPayments)}
        />
        <SummaryCard
          icon={DollarSign}
          iconColor="bg-zinc-100 text-zinc-600"
          label="Tiền ra"
          value={formatMoneyShort(summary.totalRefunds)}
          detail={formatMoneyFull(summary.totalRefunds)}
        />
        <SummaryCard
          icon={Wallet}
          iconColor="bg-zinc-100 text-zinc-900"
          label="Lợi nhuận"
          value={formatMoneyShort(summary.netRevenue)}
          detail={includeUnpaid ? `${formatMoneyFull(summary.netRevenue)} đã gồm khoản chưa thu` : formatMoneyFull(summary.netRevenue)}
        />
      </div>

      {/* Debt overview cards */}
      <div className="mb-6">
        <div className="bg-white border border-zinc-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-zinc-900" />
            </div>
            <div>
              <p className="text-zinc-600 text-sm">Học sinh đang nợ</p>
              <p className="text-2xl font-semibold text-zinc-900">{debtStudents.length}</p>
            </div>
          </div>
          <div className="text-sm text-zinc-600">
            Tổng nợ: <span className="text-zinc-900 font-semibold">{formatMoneyFull(totalDebt)}</span>
          </div>
        </div>
      </div>

      {/* Debt table */}
      {debtStudents.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">Học sinh đang nợ</h2>
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-100 border-b border-zinc-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-zinc-600">Học sinh</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-zinc-600">Trạng thái</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-zinc-600">Số nợ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {debtStudents.map((student) => (
                  <tr key={student.student_id} className="hover:bg-zinc-100/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-zinc-900 font-medium">{student.full_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <StudentStatusBadge status={student.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-zinc-700 font-semibold">
                        -{formatMoneyShort(Math.abs(student.balance))}
                      </span>
                      <p className="text-xs text-zinc-500">{formatMoneyFull(Math.abs(student.balance))}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-50 border-t border-zinc-200">
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-sm font-medium text-zinc-600">Tổng cộng</td>
                  <td className="px-6 py-4 text-right text-zinc-900 font-semibold">
                    {formatMoneyFull(totalDebt)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {debtStudents.length === 0 && !loading && (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <Wallet className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <p className="text-zinc-900 font-medium mb-2">Không có khoản nợ</p>
          <p className="text-zinc-600 text-sm">Không có học sinh nào đang nợ học phí</p>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function SummaryCard({
  icon: Icon,
  iconColor,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-zinc-600 text-sm mb-2">{label}</p>
          <p className="text-3xl font-semibold text-zinc-900">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg ${iconColor} flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <p className="text-xs text-zinc-500 mt-2">{detail}</p>
    </div>
  );
}

function StudentStatusBadge({ status }: { status: "active" | "pending_archive" | "archived" }) {
  switch (status) {
    case "active":
      return <span className="px-3 py-1 bg-zinc-900 text-white rounded-full text-sm">Đang học</span>;
    case "pending_archive":
      return <span className="px-3 py-1 bg-zinc-300 text-zinc-700 rounded-full text-sm">Chờ xử lý</span>;
    case "archived":
      return <span className="px-3 py-1 bg-zinc-200 text-zinc-600 rounded-full text-sm">Đã lưu trữ</span>;
    default:
      return null;
  }
}
