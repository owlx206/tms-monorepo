import { useEffect, useMemo, useState } from "react";
import { BarChart3, List, Pencil, Plus, Search } from "lucide-react";

import { ApiError } from "../services/apiClient";
import {
  createTransaction,
  listTransactions,
  updateTransaction,
  type BackendTransactionType,
} from "../services/financeService";
import { listStudents } from "../services/studentService";
import {
  formatVietnamDate,
  todayVietnamDateOnly,
  vietnamDateOnly,
  vietnamDateTimeToIso,
} from "../services/vietnamTime";
import { Reports } from "./Reports";

type TransactionFilterType = "all" | "payment" | "refund";
type FinanceTab = "transactions" | "reports";

type TransactionRow = {
  id: string;
  transactionId: number | null;
  studentId: number;
  studentName: string;
  amount: number;
  type: "payment" | "refund";
  date: string;
  description: string;
};

type StudentOption = {
  id: number;
  name: string;
  status: "active" | "pending_archive" | "archived";
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

function defaultTransactionNotes(type: BackendTransactionType): string {
  return type === "payment" ? "Thu tiền học phí" : "Hoàn trả học phí";
}

export function Transactions() {
  const [activeTab, setActiveTab] = useState<FinanceTab>("transactions");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<TransactionFilterType>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionRow | null>(null);
  const [requestError, setRequestError] = useState("");
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async (): Promise<void> => {
    setRequestError("");

    try {
      const [studentList, transactionList] = await Promise.all([
        listStudents(),
        listTransactions({ limit: 200 }),
      ]);

      const studentNameById = new Map<number, string>();
      const studentOptions = studentList.map((student) => ({
        id: student.id,
        name: student.full_name,
        status: student.status,
      }));
      studentOptions.forEach((student) => {
        studentNameById.set(student.id, student.name);
      });

      const transactionRows: TransactionRow[] = transactionList.map((tx) => ({
        id: `tx-${tx.id}`,
        transactionId: tx.id,
        studentId: tx.student_id,
        studentName: studentNameById.get(tx.student_id) ?? `Học sinh #${tx.student_id}`,
        amount: parseAmount(tx.amount),
        type: tx.type,
        date: tx.recorded_at,
        description: tx.notes || (tx.type === "payment" ? "Thu tiền học phí" : "Hoàn trả học phí"),
      }));

      const merged = [...transactionRows].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      setStudents(studentOptions);
      setRows(merged);
    } catch (error) {
      setRequestError(toErrorMessage(error));
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredTransactions = useMemo(
    () => rows.filter((row) => {
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const typeLabel = row.type === "payment" ? "thu tiền" : "hoàn trả";
      const searchableText = [
        row.studentName,
        row.description,
        typeLabel,
        formatVietnamDate(row.date),
        String(Math.abs(row.amount)),
      ].join(" ").toLowerCase();
      const matchesSearch = normalizedSearch === "" || searchableText.includes(normalizedSearch);
      const matchesType = filterType === "all" || row.type === filterType;
      return matchesSearch && matchesType;
    }),
    [rows, searchTerm, filterType],
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 mb-2">Tài chính</h1>
          <p className="text-zinc-600">
            {activeTab === "transactions" ? `${filteredTransactions.length} giao dịch` : "Báo cáo thu chi và công nợ"}
          </p>
        </div>
        {activeTab === "transactions" && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-3 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Ghi nhận giao dịch
          </button>
        )}
      </div>

      {requestError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {requestError}
        </div>
      )}

      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("transactions")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "transactions"
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          <List className="h-4 w-4" />
          Giao dịch
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "reports"
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Báo cáo
        </button>
      </div>

      {activeTab === "reports" ? (
        <Reports embedded />
      ) : (
        <>
          <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-zinc-900">Giao dịch</h2>
              <p className="mt-1 text-sm text-zinc-600">Tra cứu thu tiền, học phí phát sinh và hoàn trả.</p>
            </div>
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600" />
                <input
                  type="text"
                  placeholder="Tìm học sinh, mô tả, loại giao dịch..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-100 py-3 pl-12 pr-4 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", "payment", "refund"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                      filterType === type
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    {type === "all" ? "Tất cả" : type === "payment" ? "Thu tiền" : "Hoàn trả"}
                  </button>
                ))}
              </div>
            </div>
          </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full">
          <thead className="bg-zinc-100 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-medium text-zinc-600">Ngày</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-zinc-600">Học sinh</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-zinc-600">Loại</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-zinc-600">Mô tả</th>
              <th className="px-6 py-4 text-right text-sm font-medium text-zinc-600">Số tiền</th>
              <th className="px-6 py-4 text-right text-sm font-medium text-zinc-600">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredTransactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-zinc-100/50 transition-colors">
                <td className="px-6 py-4 text-zinc-600">
                  {formatVietnamDate(tx.date)}
                </td>
                <td className="px-6 py-4 text-zinc-900 font-medium">
                  {tx.studentName}
                </td>
                <td className="px-6 py-4">{getTypeBadge(tx.type)}</td>
                <td className="px-6 py-4 text-zinc-600">{tx.description}</td>
                <td className="px-6 py-4 text-right">
                  <span className={`font-semibold ${
                    tx.type === "payment"
                      ? "text-zinc-900"
                      : tx.type === "refund"
                      ? "text-zinc-600"
                      : "text-zinc-600"
                  }`}>
                    {tx.type === "payment" ? "+" : "-"}{(Math.abs(tx.amount) / 1000).toFixed(0)}K
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {tx.transactionId ? (
                    <button
                      type="button"
                      onClick={() => setEditingTransaction(tx)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                      title="Sửa giao dịch"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="text-sm text-zinc-400">Tự sinh</span>
                  )}
                </td>
              </tr>
            ))}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-zinc-500">Không có giao dịch phù hợp.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <TransactionModal
          mode="create"
          students={students}
          submitting={submitting}
          onClose={() => setShowAddModal(false)}
          onSubmit={async (payload) => {
            setSubmitting(true);
            setRequestError("");

            try {
              await createTransaction(payload);
              setShowAddModal(false);
              await loadData();
            } catch (error) {
              setRequestError(toErrorMessage(error));
            } finally {
              setSubmitting(false);
            }
          }}
        />
      )}

      {editingTransaction && (
        <TransactionModal
          mode="edit"
          initialTransaction={editingTransaction}
          students={students}
          submitting={submitting}
          onClose={() => setEditingTransaction(null)}
          onSubmit={async (payload) => {
            if (!editingTransaction.transactionId) {
              return;
            }

            setSubmitting(true);
            setRequestError("");

            try {
              await updateTransaction(editingTransaction.transactionId, payload);
              setEditingTransaction(null);
              await loadData();
            } catch (error) {
              setRequestError(toErrorMessage(error));
            } finally {
              setSubmitting(false);
            }
          }}
        />
      )}
        </>
      )}
    </div>
  );
}

function getTypeBadge(type: "payment" | "refund") {
  switch (type) {
    case "payment":
      return <span className="rounded-full bg-zinc-900 px-3 py-1 text-sm text-white">Thu tiền</span>;
    default:
      return <span className="rounded-full bg-zinc-200 px-3 py-1 text-sm text-zinc-700">Hoàn trả</span>;
  }
}

function TransactionModal({
  mode,
  initialTransaction,
  students,
  submitting,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  initialTransaction?: TransactionRow;
  students: StudentOption[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    student_id: number;
    amount: string;
    type: BackendTransactionType;
    notes: string | null;
    recorded_at: string;
  }) => Promise<void>;
}) {
  const initialType = initialTransaction?.type === "refund" ? "refund" : "payment";
  const [studentId, setStudentId] = useState(initialTransaction ? String(initialTransaction.studentId) : "");
  const [amount, setAmount] = useState(initialTransaction ? String(Math.abs(initialTransaction.amount)) : "");
  const [type, setType] = useState<BackendTransactionType>(initialType);
  const [notes, setNotes] = useState(initialTransaction?.description ?? defaultTransactionNotes("payment"));
  const [recordedAt, setRecordedAt] = useState(
    initialTransaction ? vietnamDateOnly(initialTransaction.date) : todayVietnamDateOnly(),
  );
  const [localError, setLocalError] = useState("");
  const [studentSearch, setStudentSearch] = useState(initialTransaction?.studentName ?? "");

  const visibleStudents = useMemo(() => {
    const normalizedSearch = studentSearch.trim().toLowerCase();
    return (normalizedSearch === ""
      ? students
      : students.filter((student) => student.name.toLowerCase().includes(normalizedSearch))
    ).slice(0, 3);
  }, [students, studentSearch]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError("");

    const parsedStudentId = Number(studentId);
    const parsedAmount = Number(amount);

    if (!Number.isInteger(parsedStudentId) || parsedStudentId <= 0) {
      setLocalError("Vui lòng chọn học sinh hợp lệ");
      return;
    }

    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      setLocalError("Số tiền phải là số nguyên dương");
      return;
    }

    await onSubmit({
      student_id: parsedStudentId,
      amount: type === "refund" ? String(parsedAmount * -1) : String(parsedAmount),
      type,
      notes: notes.trim() || null,
      recorded_at: vietnamDateTimeToIso(recordedAt),
    });
  };

  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-6 w-full max-w-md">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">
              {mode === "create" ? "Ghi nhận giao dịch" : "Sửa giao dịch"}
            </h2>
          </div>

          <div>
            <label className="block text-sm text-zinc-600 mb-2">Học sinh</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                placeholder="Tìm học sinh..."
              />
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1">
              {visibleStudents.map((student) => {
                const isSelected = String(student.id) === studentId;

                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => {
                      setStudentId(String(student.id));
                      setStudentSearch(student.name);
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-900 hover:bg-zinc-100"
                    }`}
                  >
                    <span className="font-medium">{student.name}</span>
                    {isSelected && <span className="text-sm text-zinc-300">Đã chọn</span>}
                  </button>
                );
              })}

              {visibleStudents.length === 0 && (
                <div className="px-3 py-3 text-sm text-zinc-500">Không tìm thấy học sinh.</div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-600 mb-2">Loại giao dịch</label>
            <select
              value={type}
              onChange={(event) => {
                const nextType = event.target.value as BackendTransactionType;
                setType(nextType);
                setNotes(defaultTransactionNotes(nextType));
              }}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="payment">Thu tiền</option>
              <option value="refund">Hoàn trả</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-600 mb-2">Số tiền (VNĐ)</label>
            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="500000"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-600 mb-2">Mô tả</label>
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="Nộp học phí tháng 4"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-600 mb-2">Ngày giao dịch</label>
            <input
              type="date"
              value={recordedAt}
              onChange={(event) => setRecordedAt(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          {localError && <p className="text-sm text-red-600">{localError}</p>}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium disabled:opacity-60"
            >
              {submitting ? "Đang lưu..." : mode === "create" ? "Ghi nhận" : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
