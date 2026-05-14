import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle, CheckCircle2, DollarSign, UserPlus } from "lucide-react";

import { ApiError } from "../services/apiClient";
import { listClasses, type BackendClass } from "../services/classService";
import {
  archiveStudent,
  listStudents,
  reinstateStudent,
  type BackendStudentSummary,
} from "../services/studentService";

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

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

export function PendingArchive() {
  const [pendingStudents, setPendingStudents] = useState<BackendStudentSummary[]>([]);
  const [activeClasses, setActiveClasses] = useState<BackendClass[]>([]);
  const [reinstatingStudent, setReinstatingStudent] = useState<BackendStudentSummary | null>(null);
  const [requestError, setRequestError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingStudentId, setSubmittingStudentId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    setRequestError("");

    try {
      const [students, classes] = await Promise.all([
        listStudents({ status: "pending_archive" }),
        listClasses("active", { readyOnly: true }),
      ]);
      setPendingStudents(students);
      setActiveClasses(classes);
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const needCollect = useMemo(
    () => pendingStudents.filter((student) => parseAmount(student.balance) < 0),
    [pendingStudents],
  );
  const needRefund = useMemo(
    () => pendingStudents.filter((student) => parseAmount(student.balance) > 0),
    [pendingStudents],
  );
  const zeroBalance = useMemo(
    () => pendingStudents.filter((student) => parseAmount(student.balance) === 0),
    [pendingStudents],
  );

  const handleArchiveZeroBalance = async (student: BackendStudentSummary) => {
    setSubmittingStudentId(student.id);
    setRequestError("");

    try {
      await archiveStudent(student.id);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmittingStudentId(null);
    }
  };

  const handleReinstateStudent = async (student: BackendStudentSummary, classId: number) => {
    setSubmittingStudentId(student.id);
    setRequestError("");

    try {
      await reinstateStudent({
        student_id: student.id,
        class_id: classId,
      });
      setReinstatingStudent(null);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmittingStudentId(null);
    }
  };

  const totalDebt = needCollect.reduce((sum, student) => sum + Math.abs(parseAmount(student.balance)), 0);
  const totalRefund = needRefund.reduce((sum, student) => sum + parseAmount(student.balance), 0);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-zinc-900 mb-2">Học sinh chờ xử lý</h1>
        <p className="text-zinc-600">
          {loading ? "Đang tải..." : `${pendingStudents.length} học sinh đang chờ xử lý`}
        </p>
      </div>

      {requestError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {requestError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-zinc-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-zinc-900" />
            </div>
            <div>
              <p className="text-zinc-600 text-sm">Cần đòi nợ</p>
              <p className="text-2xl font-semibold text-zinc-900">{needCollect.length}</p>
            </div>
          </div>
          <div className="text-sm text-zinc-600">
            Tổng nợ: <span className="text-zinc-900 font-semibold">{formatMoney(totalDebt)}</span>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-zinc-900" />
            </div>
            <div>
              <p className="text-zinc-600 text-sm">Cần hoàn trả</p>
              <p className="text-2xl font-semibold text-zinc-900">{needRefund.length}</p>
            </div>
          </div>
          <div className="text-sm text-zinc-600">
            Tổng dư: <span className="text-zinc-900 font-semibold">{formatMoney(totalRefund)}</span>
          </div>
        </div>
      </div>

      <PendingTable
        title="Cần đòi nợ"
        students={needCollect}
        amountLabel="Số nợ"
        submittingStudentId={submittingStudentId}
        onReinstate={setReinstatingStudent}
        onComplete={handleArchiveZeroBalance}
      />

      <PendingTable
        title="Cần hoàn trả"
        students={needRefund}
        amountLabel="Số dư"
        submittingStudentId={submittingStudentId}
        onReinstate={setReinstatingStudent}
        onComplete={handleArchiveZeroBalance}
      />

      <PendingTable
        title="Không còn tồn đọng"
        students={zeroBalance}
        amountLabel="Số dư"
        submittingStudentId={submittingStudentId}
        onReinstate={setReinstatingStudent}
        onComplete={handleArchiveZeroBalance}
      />

      {!loading && pendingStudents.length === 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <CheckCircle className="w-12 h-12 text-zinc-900 mx-auto mb-4" />
          <p className="text-zinc-900 font-medium mb-2">Không có học sinh nào chờ xử lý</p>
          <p className="text-zinc-600 text-sm">Tất cả học sinh đã được xử lý xong</p>
        </div>
      )}

      {reinstatingStudent && (
        <ReinstatePendingStudentModal
          student={reinstatingStudent}
          classes={activeClasses}
          submitting={submittingStudentId === reinstatingStudent.id}
          onClose={() => setReinstatingStudent(null)}
          onSubmit={(classId) => handleReinstateStudent(reinstatingStudent, classId)}
        />
      )}
    </div>
  );
}

function PendingTable({
  title,
  students,
  amountLabel,
  submittingStudentId,
  onReinstate,
  onComplete,
}: {
  title: string;
  students: BackendStudentSummary[];
  amountLabel: string;
  submittingStudentId: number | null;
  onReinstate: (student: BackendStudentSummary) => void;
  onComplete: (student: BackendStudentSummary) => Promise<void>;
}) {
  if (students.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-zinc-900 mb-4">{title}</h2>
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-100 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-medium text-zinc-600">Học sinh</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-zinc-600">Lớp hiện tại</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-zinc-600">{amountLabel}</th>
              <th className="px-6 py-4 text-right text-sm font-medium text-zinc-600">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {students.map((student) => {
              const amount = parseAmount(student.balance);
              const canComplete = amount === 0;
              const isSubmitting = submittingStudentId === student.id;
              return (
                <tr key={student.id} className="hover:bg-zinc-100/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-zinc-900 font-medium">{student.full_name}</p>
                    {student.discord_username && (
                      <p className="text-sm text-zinc-600">{student.discord_username}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-zinc-600">
                    {student.current_class_id ? `#${student.current_class_id}` : "Không còn lớp"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-zinc-900 font-semibold">{formatMoney(Math.abs(amount))}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onReinstate(student)}
                        disabled={isSubmitting}
                        title="Thêm lại"
                        aria-label={`Thêm lại ${student.full_name}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-60"
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onComplete(student)}
                        disabled={!canComplete || isSubmitting}
                        title={canComplete ? "Hoàn thành" : "Cần nhập giao dịch để số dư về 0 trước"}
                        aria-label={`Hoàn thành ${student.full_name}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReinstatePendingStudentModal({
  student,
  classes,
  submitting,
  onClose,
  onSubmit,
}: {
  student: BackendStudentSummary;
  classes: BackendClass[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (classId: number) => Promise<void>;
}) {
  const [classId, setClassId] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError("");

    const parsedClassId = Number(classId);
    if (!Number.isInteger(parsedClassId) || parsedClassId <= 0) {
      setLocalError("Vui lòng chọn lớp hợp lệ");
      return;
    }

    await onSubmit(parsedClassId);
  };

  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">Thêm lại học sinh</h2>
        <p className="text-zinc-600 mb-6">Học sinh: {student.full_name}</p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm text-zinc-600 mb-2">Lớp</label>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              disabled={submitting || classes.length === 0}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-60"
            >
              <option value="">Chọn lớp</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          {classes.length === 0 && (
            <p className="text-sm text-zinc-600">Chưa có lớp active sẵn sàng để thêm học sinh.</p>
          )}
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
              disabled={submitting || classes.length === 0}
              className="flex-1 px-4 py-3 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium disabled:opacity-60"
            >
              {submitting ? "Đang xử lý..." : "Xác nhận"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
