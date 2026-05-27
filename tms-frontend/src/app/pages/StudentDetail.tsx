import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, GraduationCap, DollarSign, BookOpen, ExternalLink, Receipt } from "lucide-react";

import { ApiError } from "../services/apiClient";
import { listClasses } from "../services/classService";
import {
  listFeeRecords,
  listTransactions,
  updateFeeRecordStatus,
  type BackendFeeRecord,
  type BackendFeeRecordStatus,
} from "../services/financeService";
import { getStudentLearningProfile, type StudentLearningProfile } from "../services/reportingService";
import { getStudent, type BackendStudentSummary } from "../services/studentService";
import { formatVietnamDate } from "../services/vietnamTime";

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

export function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState("");
  const [student, setStudent] = useState<BackendStudentSummary | null>(null);
  const [className, setClassName] = useState<string>("N/A");
  const [transactions, setTransactions] = useState<
    Array<{
      id: number;
      type: "payment" | "refund";
      amount: number;
      recorded_at: string;
      notes: string | null;
    }>
  >([]);
  const [learningTopics, setLearningTopics] = useState<StudentLearningProfile["topics"]>([]);
  const [feeRecords, setFeeRecords] = useState<BackendFeeRecord[]>([]);
  const [financeTab, setFinanceTab] = useState<"transactions" | "fee_records">("transactions");
  const [feeRecordsPage, setFeeRecordsPage] = useState(1);
  const [savingFeeRecordId, setSavingFeeRecordId] = useState<number | null>(null);
  const FEE_RECORDS_PER_PAGE = 20;

  const loadData = async (studentId: number) => {
    setLoading(true);
    setRequestError("");

    try {
      const [studentData, classes, txList, learningProfile, feeRecordList] = await Promise.all([
        getStudent(studentId),
        listClasses(),
        listTransactions({ student_id: studentId }),
        getStudentLearningProfile(studentId),
        listFeeRecords({ student_id: studentId }),
      ]);

      setStudent(studentData);

      const matchedClass = classes.find((item) => item.id === studentData.current_class_id);
      setClassName(matchedClass?.name ?? "N/A");

      setTransactions(
        txList.map((item) => ({
          id: item.id,
          type: item.type,
          amount: parseAmount(item.amount),
          recorded_at: item.recorded_at,
          notes: item.notes,
        })),
      );
      setLearningTopics(learningProfile.topics);
      setFeeRecords(feeRecordList);
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const studentId = Number(id);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      setRequestError("ID học sinh không hợp lệ");
      setLoading(false);
      return;
    }

    void loadData(studentId);
  }, [id]);

  const handleUpdateFeeRecordStatus = async (feeRecordId: number, status: BackendFeeRecordStatus) => {
    const studentId = Number(id);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return;
    }

    setSavingFeeRecordId(feeRecordId);
    setRequestError("");

    try {
      await updateFeeRecordStatus(feeRecordId, status);
      await loadData(studentId);
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSavingFeeRecordId(null);
    }
  };

  const statusBadge = useMemo(() => {
    if (!student) {
      return null;
    }

    switch (student.status) {
      case "active":
        return <span className="px-3 py-1 bg-zinc-900 text-white rounded-full text-sm">Đang học</span>;
      case "pending_archive":
        return <span className="px-3 py-1 bg-zinc-300 text-zinc-700 rounded-full text-sm">Chờ xử lý</span>;
      case "archived":
        return <span className="px-3 py-1 bg-zinc-200 text-zinc-600 rounded-full text-sm">Đã lưu trữ</span>;
      default:
        return null;
    }
  }, [student]);

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-zinc-600">Đang tải dữ liệu học sinh...</p>
      </div>
    );
  }

  if (!student || requestError) {
    return (
      <div className="p-8">
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <p className="text-zinc-600">{requestError || "Không tìm thấy học sinh"}</p>
          <button
            onClick={() => navigate("/students")}
            className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const studentBalance = parseAmount(student.balance);
  const transactionsTotal = parseAmount(student.transactions_total);
  const activeFeeTotal = parseAmount(student.active_fee_total);

  return (
    <div className="p-8">
      <button
        onClick={() => navigate("/students")}
        className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại danh sách
      </button>

      <div className="bg-white border border-zinc-200 rounded-xl p-8 mb-6 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900 mb-2">{student.full_name}</h1>
          </div>
          {statusBadge}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-5 h-5 text-zinc-600" />
              <span className="text-sm text-zinc-600">Lớp học</span>
            </div>
            <p className="text-lg font-semibold text-zinc-900">{className}</p>
          </div>

          <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-zinc-600" />
              <span className="text-sm text-zinc-600">Đã đóng</span>
            </div>
            <p className="text-lg font-semibold text-zinc-900">
              {(Math.abs(transactionsTotal) / 1000).toFixed(0)}K
            </p>
          </div>

          <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="w-5 h-5 text-zinc-600" />
              <span className="text-sm text-zinc-600">Học phí</span>
            </div>
            <p className="text-lg font-semibold text-zinc-900">
              {(Math.abs(activeFeeTotal) / 1000).toFixed(0)}K
            </p>
          </div>

          <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-zinc-600" />
              <span className="text-sm text-zinc-600">Số dư</span>
            </div>
            <p className={`text-lg font-semibold ${
              studentBalance < 0 ? "text-zinc-700" : studentBalance > 0 ? "text-zinc-600" : "text-zinc-500"
            }`}>
              {studentBalance < 0 ? "-" : studentBalance > 0 ? "+" : ""}
              {(Math.abs(studentBalance) / 1000).toFixed(0)}K
            </p>
          </div>

          <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-zinc-600">Ngày nhập học</span>
            </div>
            <p className="text-lg font-semibold text-zinc-900">
              {formatVietnamDate(student.created_at)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Tiến độ chuyên đề</h2>
            <p className="text-sm text-zinc-600 mt-1">Số bài đã giải trong các chuyên đề học sinh tham gia</p>
          </div>
          <BookOpen className="w-5 h-5 text-zinc-600" />
        </div>

        {learningTopics.length > 0 ? (
          <div className="space-y-3">
            {learningTopics.map((topic) => {
              const totalProblems = topic.total_problems;
              const solvedCount = topic.solved_count;
              const progress = totalProblems > 0 ? Math.round((solvedCount / totalProblems) * 100) : 0;

              return (
                <div key={topic.topic_id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-medium text-zinc-900">{topic.topic_title}</p>
                      <p className="text-sm text-zinc-600">{topic.class_name}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {topic.problems.map((problem) => (
                          <span
                            key={problem.problem_id}
                            className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs ${
                              problem.solved
                                ? "bg-zinc-900 text-white"
                                : "bg-white text-zinc-500 border border-zinc-200"
                            }`}
                            title={problem.problem_name ?? problem.problem_index}
                          >
                            {problem.problem_index}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="md:min-w-44 md:text-right">
                      <p className="text-2xl font-semibold text-zinc-900">
                        {solvedCount}/{totalProblems}
                      </p>
                      <p className="text-sm text-zinc-600">bài đã giải</p>
                      <div className="mt-3 h-2 rounded-full bg-zinc-200">
                        <div
                          className="h-2 rounded-full bg-zinc-900"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <a
                        href={topic.gym_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Codeforces
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-zinc-500 text-center py-8">
            Chưa có dữ liệu standing cho học sinh này.
          </p>
        )}
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm">
        <div className="flex border-b border-zinc-200">
          <button
            onClick={() => setFinanceTab("transactions")}
            className={`flex-1 px-6 py-4 font-medium text-sm transition-colors ${financeTab === "transactions" ? "text-zinc-900 border-b-2 border-zinc-900" : "text-zinc-500 hover:text-zinc-700"}`}
          >
            <DollarSign className="w-4 h-4 inline mr-2" />
            Giao dịch ({transactions.length})
          </button>
          <button
            onClick={() => setFinanceTab("fee_records")}
            className={`flex-1 px-6 py-4 font-medium text-sm transition-colors ${financeTab === "fee_records" ? "text-zinc-900 border-b-2 border-zinc-900" : "text-zinc-500 hover:text-zinc-700"}`}
          >
            <Receipt className="w-4 h-4 inline mr-2" />
            Học phí phát sinh ({feeRecords.length})
          </button>
        </div>

        <div className="p-6">
          {financeTab === "transactions" && (
            <>
              {transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                      <div>
                        <p className="text-zinc-900 font-medium">{tx.notes || "Giao dịch tài chính"}</p>
                        <p className="text-sm text-zinc-600">
                          {formatVietnamDate(tx.recorded_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`font-semibold ${tx.type === "payment" ? "text-zinc-900" : "text-zinc-600"}`}>
                          {tx.type === "payment" ? "+" : "-"}
                          {(Math.abs(tx.amount) / 1000).toFixed(0)}K
                        </span>
                        <p className="text-xs text-zinc-500 mt-1">
                          {tx.type === "payment" ? "Thu tiền" : "Hoàn trả"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 text-center py-8">Chưa có giao dịch nào</p>
              )}
            </>
          )}

          {financeTab === "fee_records" && (
            <>
              {feeRecords.length > 0 ? (
                <>
                  <div className="overflow-hidden rounded-lg border border-zinc-200">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-zinc-600">Ngày</th>
                          <th className="px-4 py-3 text-left font-medium text-zinc-600">Session ID</th>
                          <th className="px-4 py-3 text-right font-medium text-zinc-600">Số tiền</th>
                          <th className="px-4 py-3 text-center font-medium text-zinc-600">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {feeRecords.slice(0, feeRecordsPage * FEE_RECORDS_PER_PAGE).map((fr) => (
                          <tr key={fr.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-4 py-3 text-zinc-900">
                              {formatVietnamDate(fr.created_at)}
                            </td>
                            <td className="px-4 py-3 text-zinc-600 font-mono text-xs">#{fr.session_id}</td>
                            <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                              {(parseAmount(fr.amount) / 1000).toFixed(0)}K
                            </td>
                            <td className="px-4 py-3 text-center">
                              <select
                                value={fr.status}
                                onChange={(event) => {
                                  void handleUpdateFeeRecordStatus(fr.id, event.target.value as BackendFeeRecordStatus);
                                }}
                                disabled={savingFeeRecordId === fr.id}
                                className={`rounded-full border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-400 ${
                                  fr.status === "active"
                                    ? "border-zinc-900 bg-zinc-900 text-white"
                                    : "border-zinc-200 bg-zinc-200 text-zinc-600"
                                }`}
                              >
                                <option value="active">Có hiệu lực</option>
                                <option value="cancelled">Vô hiệu lực</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {feeRecords.length > feeRecordsPage * FEE_RECORDS_PER_PAGE && (
                    <button
                      onClick={() => setFeeRecordsPage((p) => p + 1)}
                      className="mt-4 w-full py-3 bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors text-sm font-medium"
                    >
                      Xem thêm ({feeRecords.length - feeRecordsPage * FEE_RECORDS_PER_PAGE} còn lại)
                    </button>
                  )}
                </>
              ) : (
                <p className="text-zinc-500 text-center py-8">Chưa có học phí phát sinh nào</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
