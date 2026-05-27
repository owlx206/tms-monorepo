import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { ApiError } from "../services/apiClient";
import { listClasses } from "../services/classService";
import { getTopicStanding, type BackendTopicStandingMatrix } from "../services/topicService";
import { formatVietnamDateTime } from "../services/vietnamTime";

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Đã có lỗi xảy ra";
}

export function TopicStanding() {
  const { classId: classIdParam, gymId: gymIdParam } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState("");
  const [matrix, setMatrix] = useState<BackendTopicStandingMatrix | null>(null);
  const [className, setClassName] = useState<string>("N/A");
  const [autoSyncTick, setAutoSyncTick] = useState(15);

  const loadData = async (showLoading = true) => {
    const classId = Number(classIdParam);
    const gymId = Number(gymIdParam);
    if (!Number.isInteger(classId) || classId <= 0 || !Number.isInteger(gymId) || gymId <= 0) {
      setRequestError("ID GYM không hợp lệ");
      setLoading(false);
      return;
    }

    if (showLoading) {
      setLoading(true);
    }
    setRequestError("");

    try {
      const [standingMatrix, classes] = await Promise.all([
        getTopicStanding(classId, gymId),
        listClasses(),
      ]);

      const classItem = classes.find((item) => item.id === standingMatrix.gym.class_id);
      setClassName(classItem?.name ?? `Lớp #${standingMatrix.gym.class_id}`);
      setMatrix(standingMatrix);
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadData();
  }, [classIdParam, gymIdParam]);

  useEffect(() => {
    setAutoSyncTick(15);
    const timer = window.setInterval(() => {
      setAutoSyncTick((current) => {
        if (current <= 1) {
          void loadData(false);
          return 15;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [classIdParam, gymIdParam]);

  const lastPulled = useMemo(() => {
    if (!matrix) {
      return null;
    }

    let last = matrix.gym.last_pulled_at ? new Date(matrix.gym.last_pulled_at) : null;
    matrix.rows.forEach((row) => {
      row.problems.forEach((problem) => {
        if (!problem.pulled_at) {
          return;
        }

        const pulledAt = new Date(problem.pulled_at);
        if (!last || pulledAt.getTime() > last.getTime()) {
          last = pulledAt;
        }
      });
    });

    return last;
  }, [matrix]);

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-zinc-600">Đang tải standing...</p>
      </div>
    );
  }

  if (!matrix || requestError) {
    return (
      <div className="p-8">
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <p className="text-zinc-600">{requestError || "Không tìm thấy GYM"}</p>
          <button
            onClick={() => {
              const classId = Number(classIdParam);
              navigate(Number.isInteger(classId) && classId > 0 ? `/classes/${classId}` : "/classes");
            }}
            className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const sortedProblems = [...matrix.problems].sort((a, b) => a.problem_index.localeCompare(b.problem_index, "vi"));

  return (
    <div className="p-8">
      <button
        onClick={() => navigate(`/classes/${matrix.gym.class_id}`)}
        className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại lớp học
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 mb-2">{matrix.gym.title}</h1>
          <p className="text-zinc-600">{className}</p>
        </div>
        <button
          onClick={() => void loadData()}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Làm mới
        </button>
      </div>

      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 mb-6">
        <p className="text-sm text-zinc-600">
          Cập nhật lần cuối: {lastPulled ? formatVietnamDateTime(lastPulled) : "Chưa có dữ liệu"}
          <span className="ml-3 text-zinc-500">Tự sync sau {autoSyncTick}s</span>
        </p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-100 border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-zinc-700 sticky left-0 bg-zinc-100">
                  Học sinh
                </th>
                <th className="px-6 py-4 text-center text-sm font-medium text-zinc-700">
                  Số bài AC
                </th>
                {sortedProblems.map((problem) => (
                  <th key={problem.id} className="px-4 py-4 text-center text-sm font-medium text-zinc-700">
                    {problem.problem_index}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {matrix.rows.map((row) => {
                const cellByProblemId = new Map(row.problems.map((problem) => [problem.problem_id, problem]));

                return (
                  <tr key={row.student_id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4 text-zinc-900 font-medium sticky left-0 bg-white">
                      {row.student_name}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 bg-zinc-900 text-white rounded-full text-sm font-semibold">
                        {row.solved_count}
                      </span>
                    </td>
                    {sortedProblems.map((problem) => {
                      const cell = cellByProblemId.get(problem.id);
                      if (!cell) {
                        return (
                          <td key={problem.id} className="px-4 py-4 text-center">
                            <span className="text-zinc-400">—</span>
                          </td>
                        );
                      }

                      return (
                        <td key={problem.id} className="px-4 py-4 text-center">
                          {cell.solved ? (
                            <span className="inline-block w-8 h-8 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                              ✓
                            </span>
                          ) : typeof cell.penalty_minutes === "number" && cell.penalty_minutes > 0 ? (
                            <span className="inline-block w-8 h-8 bg-zinc-200 text-zinc-700 rounded-full flex items-center justify-center text-xs">
                              -{cell.penalty_minutes}
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {matrix.rows.length === 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center mt-6">
          <p className="text-zinc-600">Chưa có học sinh hoặc dữ liệu standing cho GYM này</p>
        </div>
      )}
    </div>
  );
}
