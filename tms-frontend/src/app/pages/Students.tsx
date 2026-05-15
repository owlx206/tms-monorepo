import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Plus,
  Search,
  UserX,
  ArrowRightLeft,
  Pencil,
  Link2,
  MessageSquare,
  AlertCircle,
  DollarSign,
  CheckCircle,
  UserPlus,
} from "lucide-react";

import { ApiError } from "../services/apiClient";
import { listClasses } from "../services/classService";
import {
  archiveStudent,
  createStudent,
  withdrawStudent,
  listStudents,
  reinstateStudent,
  transferStudent,
  updateStudent as updateStudentById,
  type BackendStudentSummary,
} from "../services/studentService";
import { getStudentDiscordAuthorizationUrl, sendStudentMessages } from "../services/messagingService";

type StudentView = {
  id: number;
  name: string;
  discordUsername: string;
  discordUserId: string;
  phone: string;
  classId: number | null;
  className: string;
  status: "active" | "pending_archive" | "archived";
  balance: number;
  joinedDate: string;
  codeforcesHandle: string;
};

type ActiveClassOption = {
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

function toStudentView(
  student: BackendStudentSummary,
  classNameById: Map<number, string>,
): StudentView {
  return {
    id: student.id,
    name: student.full_name,
    discordUsername: student.discord_username ?? "",
    discordUserId: student.discord_user_id ?? "",
    phone: student.phone ?? "",
    classId: student.current_class_id,
    className: student.current_class_id !== null
      ? classNameById.get(student.current_class_id) ?? "N/A"
      : "N/A",
    status: student.status,
    balance: parseAmount(student.balance),
    joinedDate: student.created_at.slice(0, 10),
    codeforcesHandle: student.codeforces_handle ?? "",
  };
}

export function Students() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "pending_archive" | "archived">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentView | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showReinstateModal, setShowReinstateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkTransferModal, setShowBulkTransferModal] = useState(false);
  const [showBulkWithdrawModal, setShowBulkWithdrawModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [students, setStudents] = useState<StudentView[]>([]);
  const [activeClasses, setActiveClasses] = useState<ActiveClassOption[]>([]);
  const [requestError, setRequestError] = useState("");
  const [requestNotice, setRequestNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async (): Promise<void> => {
    setRequestError("");
    setRequestNotice("");
    try {
      const [classList, studentList] = await Promise.all([
        listClasses("active", { readyOnly: true }),
        listStudents(),
      ]);

      const classNameById = new Map(classList.map((item) => [item.id, item.name]));
      setActiveClasses(classList.map((item) => ({ id: item.id, name: item.name })));
      setStudents(studentList.map((student) => toStudentView(student, classNameById)));
      setSelectedStudentIds([]);
    } catch (error) {
      setRequestError(toErrorMessage(error));
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const status = new URLSearchParams(location.search).get("discord_student");
    if (!status) {
      return;
    }

    if (status === "success") {
      setRequestNotice("Học sinh đã authorize Discord và đã được add vào server lớp.");
      return;
    }

    if (status === "authorized_no_class_server") {
      setRequestNotice("Học sinh đã authorize Discord. Lớp hiện tại chưa cấu hình server Discord.");
      return;
    }

    if (status === "cancelled") {
      setRequestError("Học sinh đã hủy authorize Discord.");
      return;
    }

    setRequestError("Học sinh đã authorize Discord nhưng chưa add được vào server lớp. Kiểm tra quyền bot rồi sync lại.");
  }, [location.search]);

  const filteredStudents = useMemo(
    () => students.filter((student) => {
      const normalizedSearch = searchTerm.toLowerCase();
      const matchesSearch = student.name.toLowerCase().includes(normalizedSearch)
        || student.discordUsername.toLowerCase().includes(normalizedSearch)
        || student.codeforcesHandle.toLowerCase().includes(normalizedSearch);
      const matchesStatus = filterStatus === "all" || student.status === filterStatus;
      return matchesSearch && matchesStatus;
    }),
    [students, searchTerm, filterStatus],
  );

  const activeFilteredStudents = useMemo(
    () => filteredStudents.filter((student) => student.status === "active"),
    [filteredStudents],
  );

  const selectedActiveStudentIds = useMemo(
    () => selectedStudentIds.filter((studentId) => activeFilteredStudents.some((student) => student.id === studentId)),
    [selectedStudentIds, activeFilteredStudents],
  );

  const isAllActiveSelected = activeFilteredStudents.length > 0
    && selectedActiveStudentIds.length === activeFilteredStudents.length;

  const pendingStudents = useMemo(
    () => students.filter((student) => student.status === "pending_archive"),
    [students],
  );

  const needCollect = useMemo(
    () => pendingStudents.filter((student) => student.balance < 0),
    [pendingStudents],
  );

  const needRefund = useMemo(
    () => pendingStudents.filter((student) => student.balance > 0),
    [pendingStudents],
  );

  const readyToArchive = useMemo(
    () => pendingStudents.filter((student) => student.balance === 0),
    [pendingStudents],
  );

  const getStatusBadge = (status: StudentView["status"]) => {
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
  };

  const getBalanceColor = (balance: number) => {
    if (balance < 0) {
      return "text-zinc-700";
    }

    if (balance > 0) {
      return "text-zinc-600";
    }

    return "text-zinc-500";
  };

  const handleCreateStudent = async (payload: {
    full_name: string;
    class_id: number;
    codeforces_handle: string;
    note: string | null;
  }) => {
    setSubmitting(true);
    setRequestError("");

    try {
      await createStudent(payload);
      setShowAddModal(false);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferStudent = async (payload: {
    student_id: number;
    to_class_id: number;
  }) => {
    setSubmitting(true);
    setRequestError("");

    try {
      await transferStudent(payload);
      setShowTransferModal(false);
      setSelectedStudent(null);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStudent = async (payload: {
    student_id: number;
    full_name: string;
    codeforces_handle: string;
    phone: string | null;
    note: string | null;
  }) => {
    setSubmitting(true);
    setRequestError("");

    try {
      await updateStudentById(payload);
      setShowEditModal(false);
      setSelectedStudent(null);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawStudent = async (student: StudentView) => {
    setSubmitting(true);
    setRequestError("");

    try {
      await withdrawStudent(student.id);
      setShowArchiveModal(false);
      setSelectedStudent(null);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyStudentDiscordAuthorizationLink = async (student: StudentView) => {
    setSubmitting(true);
    setRequestError("");
    setRequestNotice("");

    try {
      const url = await getStudentDiscordAuthorizationUrl(student.id);
      try {
        await navigator.clipboard.writeText(url);
        setRequestNotice(`Đã copy link authorize Discord cho ${student.name}`);
      } catch {
        setRequestNotice(`Link authorize Discord cho ${student.name}: ${url}`);
      }
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendStudentMessage = async (payload: {
    student_ids: number[];
    content: string;
  }) => {
    setSubmitting(true);
    setRequestError("");

    try {
      await sendStudentMessages(payload);
      setShowMessageModal(false);
      setSelectedStudent(null);
      setSelectedStudentIds([]);
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReinstateStudent = async (payload: {
    student_id: number;
    class_id: number;
  }) => {
    setSubmitting(true);
    setRequestError("");

    try {
      await reinstateStudent(payload);
      setShowReinstateModal(false);
      setSelectedStudent(null);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkTransfer = async (payload: {
    student_ids: number[];
    to_class_id: number;
  }) => {
    setSubmitting(true);
    setRequestError("");

    try {
      for (const studentId of payload.student_ids) {
        await transferStudent({
          student_id: studentId,
          to_class_id: payload.to_class_id,
        });
      }
      setShowBulkTransferModal(false);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkWithdraw = async (studentIds: number[]) => {
    setSubmitting(true);
    setRequestError("");

    try {
      for (const studentId of studentIds) {
        await withdrawStudent(studentId);
      }
      setShowBulkWithdrawModal(false);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchivePendingStudent = async (student: StudentView) => {
    setSubmitting(true);
    setRequestError("");

    try {
      await archiveStudent(student.id);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStudentSelection = (studentId: number) => {
    setSelectedStudentIds((current) => (
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    ));
  };

  const toggleSelectAllActive = () => {
    if (isAllActiveSelected) {
      setSelectedStudentIds((current) => current.filter((id) => !activeFilteredStudents.some((student) => student.id === id)));
      return;
    }

    setSelectedStudentIds((current) => (
      Array.from(new Set([...current, ...activeFilteredStudents.map((student) => student.id)]))
    ));
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 mb-2">Quản lý học sinh</h1>
          <p className="text-zinc-600">
            {filteredStudents.length} học sinh
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-3 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Thêm học sinh
        </button>
      </div>

      {requestError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {requestError}
        </div>
      )}
      {requestNotice && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {requestNotice}
        </div>
      )}

      <div className="mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
            <input
              type="text"
              placeholder="Tìm kiếm học sinh..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-zinc-100 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "active", "pending_archive", "archived"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                  filterStatus === status
                    ? "bg-zinc-200 text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {status === "all" ? "Tất cả" : status === "active" ? "Đang học" : status === "pending_archive" ? "Chờ xử lý" : "Đã lưu"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filterStatus === "pending_archive" ? (
        <>
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
                Tổng nợ: <span className="text-zinc-900 font-semibold">
                  {(needCollect.reduce((sum, student) => sum + Math.abs(student.balance), 0) / 1000).toFixed(0)}K
                </span>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-zinc-600" />
                </div>
                <div>
                  <p className="text-zinc-600 text-sm">Cần hoàn trả</p>
                  <p className="text-2xl font-semibold text-zinc-900">{needRefund.length}</p>
                </div>
              </div>
              <div className="text-sm text-zinc-600">
                Tổng dư: <span className="text-zinc-600 font-semibold">
                  {(needRefund.reduce((sum, student) => sum + student.balance, 0) / 1000).toFixed(0)}K
                </span>
              </div>
            </div>
          </div>

          {needCollect.length > 0 && (
            <PendingTable
              title="Cần đòi nợ"
              students={needCollect}
              amountLabel="Số nợ"
              actionLabel="Đã thu đủ nợ"
              submitting={submitting}
              onAction={handleArchivePendingStudent}
            />
          )}

          {needRefund.length > 0 && (
            <PendingTable
              title="Cần hoàn trả"
              students={needRefund}
              amountLabel="Số dư"
              actionLabel="Đã hoàn trả"
              submitting={submitting}
              onAction={handleArchivePendingStudent}
            />
          )}

          {readyToArchive.length > 0 && (
            <PendingTable
              title="Sẵn sàng lưu trữ"
              students={readyToArchive}
              amountLabel="Số dư"
              actionLabel="Lưu trữ"
              submitting={submitting}
              onAction={handleArchivePendingStudent}
            />
          )}

          {pendingStudents.length === 0 && (
            <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
              <CheckCircle className="w-12 h-12 text-zinc-900 mx-auto mb-4" />
              <p className="text-zinc-900 font-medium mb-2">Không có học sinh nào chờ xử lý</p>
              <p className="text-zinc-600 text-sm">Tất cả học sinh đã được xử lý xong</p>
            </div>
          )}
        </>
      ) : (
        <>
          {selectedActiveStudentIds.length > 0 && (
            <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-700">
                Đã chọn <span className="font-semibold text-zinc-900">{selectedActiveStudentIds.length}</span> học sinh
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowMessageModal(true)}
                  disabled={submitting}
                  className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 transition-colors text-sm font-medium disabled:opacity-60"
                >
                  Nhắn tin
                </button>
                <button
                  onClick={() => setShowBulkTransferModal(true)}
                  disabled={submitting}
                  className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 transition-colors text-sm font-medium disabled:opacity-60"
                >
                  Chuyển lớp hàng loạt
                </button>
                <button
                  onClick={() => setShowBulkWithdrawModal(true)}
                  disabled={submitting}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors text-sm font-medium disabled:opacity-60"
                >
                  Cho nghỉ học hàng loạt
                </button>
                <button
                  onClick={() => setSelectedStudentIds([])}
                  disabled={submitting}
                  className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors text-sm disabled:opacity-60"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>
          )}

          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-100 border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-medium text-zinc-600 w-12">
                    <input
                      type="checkbox"
                      checked={isAllActiveSelected}
                      onChange={toggleSelectAllActive}
                      aria-label="Chọn tất cả học sinh đang học"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-zinc-600">Học sinh</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-zinc-600">Lớp</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-zinc-600">Trạng thái</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-zinc-600">Số dư</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-zinc-600">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredStudents.map((student) => {
                  const isSelectable = student.status === "active";
                  const isSelected = selectedStudentIds.includes(student.id);

                  return (
                    <tr
                      key={student.id}
                      onClick={() => navigate(`/students/${student.id}`)}
                      className="cursor-pointer hover:bg-zinc-200/50 transition-colors"
                    >
                      <td className="px-4 py-4">
                        {isSelectable ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleStudentSelection(student.id)}
                            aria-label={`Chọn học sinh ${student.name}`}
                          />
                        ) : null}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-zinc-900 font-medium">{student.name}</p>
                          <StudentIdentityLine icon={<CodeforcesIcon />} value={student.codeforcesHandle || "N/A"} />
                          <StudentIdentityLine icon={<DiscordIcon />} value={student.discordUsername || "N/A"} muted />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-zinc-700">{student.className}</td>
                      <td className="px-6 py-4">{getStatusBadge(student.status)}</td>
                      <td className="px-6 py-4">
                        <span className={`font-semibold ${getBalanceColor(student.balance)}`}>
                          {student.balance < 0 ? "-" : student.balance > 0 ? "+" : ""}
                          {(Math.abs(student.balance) / 1000).toFixed(0)}K
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div
                          className="flex items-center justify-end gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setSelectedStudent(student);
                              setShowMessageModal(true);
                            }}
                            className="p-2 hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50"
                            title="Nhắn tin học sinh"
                            disabled={submitting}
                          >
                            <MessageSquare className="w-4 h-4 text-zinc-600" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedStudent(student);
                              setShowEditModal(true);
                            }}
                            className="p-2 hover:bg-zinc-200 rounded-lg transition-colors"
                            title="Sửa thông tin"
                          >
                            <Pencil className="w-4 h-4 text-zinc-600" />
                          </button>
                          {student.status === "active" && (
                            <>
                              <button
                                onClick={() => { void handleCopyStudentDiscordAuthorizationLink(student); }}
                                className="p-2 hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50"
                                title="Copy link authorize Discord"
                                disabled={submitting}
                              >
                                <Link2 className="w-4 h-4 text-zinc-600" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setShowTransferModal(true);
                                }}
                                className="p-2 hover:bg-zinc-200 rounded-lg transition-colors"
                                title="Chuyển lớp"
                              >
                                <ArrowRightLeft className="w-4 h-4 text-zinc-600" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setShowArchiveModal(true);
                                }}
                                className="p-2 hover:bg-zinc-200 rounded-lg transition-colors"
                                title="Cho nghỉ học"
                              >
                                <UserX className="w-4 h-4 text-zinc-600" />
                              </button>
                            </>
                          )}
                          {(student.status === "archived" || student.status === "pending_archive") && (
                            <button
                              onClick={() => {
                                setSelectedStudent(student);
                                setShowReinstateModal(true);
                              }}
                              className="p-2 hover:bg-zinc-200 rounded-lg transition-colors"
                              title="Thêm trở lại"
                            >
                              <UserPlus className="w-4 h-4 text-zinc-600" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showAddModal && (
        <AddStudentModal
          classes={activeClasses}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleCreateStudent}
          submitting={submitting}
          error={requestError}
        />
      )}

      {showTransferModal && selectedStudent && (
        <TransferClassModal
          student={selectedStudent}
          classes={activeClasses}
          onClose={() => {
            setShowTransferModal(false);
            setSelectedStudent(null);
          }}
          onSubmit={handleTransferStudent}
          submitting={submitting}
          error={requestError}
        />
      )}

      {showEditModal && selectedStudent && (
        <EditStudentModal
          student={selectedStudent}
          onClose={() => {
            setShowEditModal(false);
            setSelectedStudent(null);
          }}
          onSubmit={handleUpdateStudent}
          submitting={submitting}
          error={requestError}
        />
      )}

      {showArchiveModal && selectedStudent && (
        <ArchiveStudentModal
          student={selectedStudent}
          onClose={() => {
            setShowArchiveModal(false);
            setSelectedStudent(null);
          }}
          onConfirm={handleWithdrawStudent}
          submitting={submitting}
          error={requestError}
        />
      )}

      {showReinstateModal && selectedStudent && (
        <ReinstateStudentModal
          student={selectedStudent}
          classes={activeClasses}
          onClose={() => {
            setShowReinstateModal(false);
            setSelectedStudent(null);
          }}
          onSubmit={handleReinstateStudent}
          submitting={submitting}
          error={requestError}
        />
      )}

      {showBulkTransferModal && (
        <BulkTransferModal
          classes={activeClasses}
          studentCount={selectedActiveStudentIds.length}
          onClose={() => setShowBulkTransferModal(false)}
          onSubmit={(to_class_id) => handleBulkTransfer({
            student_ids: selectedActiveStudentIds,
            to_class_id,
          })}
          submitting={submitting}
          error={requestError}
        />
      )}

      {showBulkWithdrawModal && (
        <BulkWithdrawModal
          studentCount={selectedActiveStudentIds.length}
          onClose={() => setShowBulkWithdrawModal(false)}
          onConfirm={() => handleBulkWithdraw(selectedActiveStudentIds)}
          submitting={submitting}
          error={requestError}
        />
      )}

      {showMessageModal && (
        <StudentMessageModal
          title={selectedStudent ? `Nhắn tin ${selectedStudent.name}` : `Nhắn tin ${selectedActiveStudentIds.length} học sinh`}
          studentIds={selectedStudent ? [selectedStudent.id] : selectedActiveStudentIds}
          submitting={submitting}
          error={requestError}
          onClose={() => {
            setShowMessageModal(false);
            setSelectedStudent(null);
          }}
          onSubmit={handleSendStudentMessage}
        />
      )}
    </div>
  );
}

function StudentMessageModal({
  title,
  studentIds,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  title: string;
  studentIds: number[];
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (payload: { student_ids: number[]; content: string }) => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError("");

    if (studentIds.length === 0) {
      setLocalError("Vui lòng chọn ít nhất một học sinh");
      return;
    }

    if (!content.trim()) {
      setLocalError("Nội dung tin nhắn là bắt buộc");
      return;
    }

    await onSubmit({
      student_ids: studentIds,
      content: content.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-6 w-full max-w-lg">
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">{title}</h2>
        <p className="text-sm text-zinc-600 mb-6">Tin nhắn sẽ được gửi qua Discord DM.</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={8}
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            placeholder="Nhập nội dung tin nhắn..."
          />

          {(localError || error) && <p className="text-sm text-red-600">{localError || error}</p>}

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
              disabled={submitting || studentIds.length === 0}
              className="flex-1 px-4 py-3 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium disabled:opacity-60"
            >
              {submitting ? "Đang gửi..." : "Gửi tin nhắn"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PendingTable({
  title,
  students,
  amountLabel,
  actionLabel,
  submitting,
  onAction,
}: {
  title: string;
  students: StudentView[];
  amountLabel: string;
  actionLabel: string;
  submitting: boolean;
  onAction: (student: StudentView) => Promise<void>;
}) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-zinc-900 mb-4">{title}</h2>
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-100 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-medium text-zinc-600">Học sinh</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-zinc-600">Lớp cũ</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-zinc-600">{amountLabel}</th>
              <th className="px-6 py-4 text-right text-sm font-medium text-zinc-600">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {students.map((student) => (
              <tr key={student.id} className="hover:bg-zinc-100/50 transition-colors">
                <td className="px-6 py-4">
                  <div>
                    <p className="text-zinc-900 font-medium">{student.name}</p>
                    <StudentIdentityLine icon={<CodeforcesIcon />} value={student.codeforcesHandle || "N/A"} />
                    <StudentIdentityLine icon={<DiscordIcon />} value={student.discordUsername || "N/A"} muted />
                  </div>
                </td>
                <td className="px-6 py-4 text-zinc-700">{student.className || "N/A"}</td>
                <td className="px-6 py-4">
                  <span className="text-zinc-900 font-semibold">
                    {(Math.abs(student.balance) / 1000).toFixed(0)}K
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => void onAction(student)}
                      className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-60"
                      disabled={submitting}
                    >
                      {actionLabel}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentIdentityLine({
  icon,
  value,
  muted,
}: {
  icon: React.ReactNode;
  value: string;
  muted?: boolean;
}) {
  return (
    <p className={`mt-1 flex items-center gap-2 ${muted ? "text-sm text-zinc-600" : "text-sm text-zinc-700"}`}>
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-zinc-500">
        {icon}
      </span>
      <span>{value}</span>
    </p>
  );
}

function CodeforcesIcon() {
  return (
    <span className="inline-flex h-4 w-4 items-end justify-center gap-0.5" aria-label="Codeforces">
      <span className="h-2.5 w-1 rounded-sm bg-current" />
      <span className="h-4 w-1 rounded-sm bg-current" />
      <span className="h-3 w-1 rounded-sm bg-current" />
    </span>
  );
}

function DiscordIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-label="Discord"
    >
      <path d="M19.3 5.2A17.1 17.1 0 0 0 15.1 4l-.2.4c1.5.4 2.2 1 2.2 1s-2.7-1.5-6.2-1.5c-3.5 0-6.2 1.5-6.2 1.5s.8-.7 2.4-1.1L6.9 4a17.1 17.1 0 0 0-4.2 1.2C.1 9.1-.6 12.8-.3 16.5A17 17 0 0 0 5 19.2l.7-1.1a7.1 7.1 0 0 1-1.2-.6l.3-.2c2.3 1.1 4.8 1.1 7.2 1.1s4.9 0 7.2-1.1l.3.2c-.4.3-.8.5-1.2.6l.7 1.1a17 17 0 0 0 5.3-2.7c.4-4.3-.7-8-3-11.3ZM8.2 14.3c-.8 0-1.4-.7-1.4-1.5s.6-1.5 1.4-1.5 1.4.7 1.4 1.5-.6 1.5-1.4 1.5Zm7.6 0c-.8 0-1.4-.7-1.4-1.5s.6-1.5 1.4-1.5 1.4.7 1.4 1.5-.6 1.5-1.4 1.5Z" />
    </svg>
  );
}

function AddStudentModal({
  classes,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  classes: ActiveClassOption[];
  onClose: () => void;
  onSubmit: (payload: {
    full_name: string;
    class_id: number;
    codeforces_handle: string;
    note: string | null;
  }) => Promise<void>;
  submitting: boolean;
  error: string;
}) {
  const [name, setName] = useState("");
  const [classId, setClassId] = useState("");
  const [codeforcesHandle, setCodeforcesHandle] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError("");

    const classIdValue = Number(classId);

    if (!name.trim()) {
      setLocalError("Họ tên là bắt buộc");
      return;
    }

    if (!Number.isInteger(classIdValue) || classIdValue <= 0) {
      setLocalError("Vui lòng chọn lớp hợp lệ");
      return;
    }

    if (!codeforcesHandle.trim()) {
      setLocalError("Codeforces handle là bắt buộc");
      return;
    }

    await onSubmit({
      full_name: name.trim(),
      class_id: classIdValue,
      codeforces_handle: codeforcesHandle.trim(),
      note: null,
    });
  };

  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-6 w-full max-w-md">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm text-zinc-600 mb-2">Họ tên</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="Nguyễn Văn A"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-600 mb-2">Lớp</label>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">Chọn lớp</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-600 mb-2">Codeforces Handle</label>
            <input
              type="text"
              value={codeforcesHandle}
              onChange={(event) => setCodeforcesHandle(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="username"
            />
          </div>

          {(localError || error) && <p className="text-sm text-red-600">{localError || error}</p>}

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
              {submitting ? "Đang thêm..." : "Thêm học sinh"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditStudentModal({
  student,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  student: StudentView;
  onClose: () => void;
  onSubmit: (payload: {
    student_id: number;
    full_name: string;
    codeforces_handle: string;
    phone: string | null;
    note: string | null;
  }) => Promise<void>;
  submitting: boolean;
  error: string;
}) {
  const [name, setName] = useState(student.name);
  const [codeforcesHandle, setCodeforcesHandle] = useState(student.codeforcesHandle);
  const [phone, setPhone] = useState(student.phone);
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError("");

    if (!name.trim()) {
      setLocalError("Họ tên là bắt buộc");
      return;
    }

    if (!codeforcesHandle.trim()) {
      setLocalError("Codeforces handle là bắt buộc");
      return;
    }

    await onSubmit({
      student_id: student.id,
      full_name: name.trim(),
      codeforces_handle: codeforcesHandle.trim(),
      phone: phone.trim() || null,
      note: null,
    });
  };

  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">Sửa thông tin học sinh</h2>
        <p className="text-zinc-600 mb-6">ID: {student.id}</p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm text-zinc-600 mb-2">Họ tên</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="Nguyễn Văn A"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-600 mb-2">Codeforces Handle</label>
            <input
              type="text"
              value={codeforcesHandle}
              onChange={(event) => setCodeforcesHandle(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="username"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-600 mb-2">Số điện thoại (tùy chọn)</label>
            <input
              type="text"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="09xxxxxxxx"
            />
          </div>

          {(localError || error) && <p className="text-sm text-red-600">{localError || error}</p>}

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

function TransferClassModal({
  student,
  classes,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  student: StudentView;
  classes: ActiveClassOption[];
  onClose: () => void;
  onSubmit: (payload: { student_id: number; to_class_id: number }) => Promise<void>;
  submitting: boolean;
  error: string;
}) {
  const [toClassId, setToClassId] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError("");

    const classId = Number(toClassId);
    if (!Number.isInteger(classId) || classId <= 0) {
      setLocalError("Vui lòng chọn lớp mới hợp lệ");
      return;
    }

    await onSubmit({
      student_id: student.id,
      to_class_id: classId,
    });
  };

  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">Chuyển lớp</h2>
        <p className="text-zinc-600 mb-6">Học sinh: {student.name}</p>

        <div className="bg-zinc-100 border border-zinc-700 rounded-lg p-4 mb-6">
          <p className="text-zinc-700 text-sm">
            ⚠️ Học sinh phải trả toàn bộ số nợ của lớp cũ trước khi chuyển lớp
          </p>
          <p className="text-zinc-600 text-sm mt-2">
            Số nợ hiện tại: <span className="text-zinc-900 font-semibold">-{(Math.abs(student.balance) / 1000).toFixed(0)}K</span>
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm text-zinc-600 mb-2">Lớp mới</label>
            <select
              value={toClassId}
              onChange={(event) => setToClassId(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">Chọn lớp</option>
              {classes
                .filter((cls) => cls.id !== student.classId)
                .map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
            </select>
          </div>

          {(localError || error) && <p className="text-sm text-red-600">{localError || error}</p>}

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
              {submitting ? "Đang chuyển..." : "Chuyển lớp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ArchiveStudentModal({
  student,
  onClose,
  onConfirm,
  submitting,
  error,
}: {
  student: StudentView;
  onClose: () => void;
  onConfirm: (student: StudentView) => Promise<void>;
  submitting: boolean;
  error: string;
}) {
  const action = student.balance < 0 ? "collect" : student.balance > 0 ? "refund" : "archive";

  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">Cho nghỉ học</h2>
        <p className="text-zinc-600 mb-6">Học sinh: {student.name}</p>

        <div className="bg-zinc-100 border border-zinc-700 rounded-lg p-4 mb-6">
          {action === "collect" && (
            <>
              <p className="text-zinc-900 font-semibold mb-2">Học sinh còn nợ</p>
              <p className="text-zinc-600 text-sm">
                Số nợ: <span className="text-zinc-900 font-semibold">-{(Math.abs(student.balance) / 1000).toFixed(0)}K</span>
              </p>
              <p className="text-zinc-600 text-sm mt-2">
                Học sinh sẽ được chuyển sang trạng thái "Chờ đòi nợ"
              </p>
            </>
          )}
          {action === "refund" && (
            <>
              <p className="text-zinc-900 font-semibold mb-2">Học sinh dư tiền</p>
              <p className="text-zinc-600 text-sm">
                Số dư: <span className="text-zinc-900 font-semibold">+{(student.balance / 1000).toFixed(0)}K</span>
              </p>
              <p className="text-zinc-600 text-sm mt-2">
                Học sinh sẽ được chuyển sang trạng thái "Chờ hoàn trả"
              </p>
            </>
          )}
          {action === "archive" && (
            <>
              <p className="text-zinc-700 font-semibold mb-2">Không nợ, không dư</p>
              <p className="text-zinc-600 text-sm">
                Học sinh sẽ được lưu trữ ngay lập tức
              </p>
            </>
          )}
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-3 bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void onConfirm(student)}
            disabled={submitting}
            className="flex-1 px-4 py-3 bg-zinc-200 text-zinc-900 rounded-lg hover:bg-zinc-600 transition-colors font-medium disabled:opacity-60"
          >
            {submitting ? "Đang xử lý..." : "Xác nhận cho nghỉ học"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReinstateStudentModal({
  student,
  classes,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  student: StudentView;
  classes: ActiveClassOption[];
  onClose: () => void;
  onSubmit: (payload: { student_id: number; class_id: number }) => Promise<void>;
  submitting: boolean;
  error: string;
}) {
  const [classId, setClassId] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError("");

    const parsedClassId = Number(classId);
    if (!Number.isInteger(parsedClassId) || parsedClassId <= 0) {
      setLocalError("Vui lòng chọn lớp hợp lệ");
      return;
    }

    await onSubmit({
      student_id: student.id,
      class_id: parsedClassId,
    });
  };

  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-6 w-full max-w-md">
        <p className="text-zinc-600 mb-6">Học sinh: {student.name}</p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm text-zinc-600 mb-2">Lớp mới</label>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">Chọn lớp</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          {(localError || error) && <p className="text-sm text-red-600">{localError || error}</p>}

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
              {submitting ? "Đang xử lý..." : "Xác nhận thêm trở lại"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BulkTransferModal({
  classes,
  studentCount,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  classes: ActiveClassOption[];
  studentCount: number;
  onClose: () => void;
  onSubmit: (to_class_id: number) => Promise<void>;
  submitting: boolean;
  error: string;
}) {
  const [classId, setClassId] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
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
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">Chuyển lớp hàng loạt</h2>
        <p className="text-zinc-600 mb-6">Số học sinh đã chọn: {studentCount}</p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm text-zinc-600 mb-2">Lớp đích</label>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">Chọn lớp</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          {(localError || error) && <p className="text-sm text-red-600">{localError || error}</p>}

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
              {submitting ? "Đang xử lý..." : "Xác nhận chuyển lớp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BulkWithdrawModal({
  studentCount,
  onClose,
  onConfirm,
  submitting,
  error,
}: {
  studentCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  submitting: boolean;
  error: string;
}) {
  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">Cho nghỉ học hàng loạt</h2>
        <p className="text-zinc-600 mb-6">Bạn chắc chắn muốn cho {studentCount} học sinh đã chọn nghỉ học?</p>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-3 bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={submitting}
            className="flex-1 px-4 py-3 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium disabled:opacity-60"
          >
            {submitting ? "Đang xử lý..." : "Xác nhận cho nghỉ học"}
          </button>
        </div>
      </div>
    </div>
  );
}
