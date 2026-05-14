import { useEffect, useMemo, useState } from "react";
import { Plus, ExternalLink, BarChart3, XCircle } from "lucide-react";
import { useNavigate } from "react-router";

import { ApiError } from "../services/apiClient";
import { listClasses } from "../services/classService";
import { closeTopic, createTopic, listTopics, type BackendTopic } from "../services/topicService";

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

export function Topics() {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [topics, setTopics] = useState<BackendTopic[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [requestError, setRequestError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setRequestError("");

    try {
      const [classList, topicList] = await Promise.all([
        listClasses("active", { readyOnly: true }),
        listTopics(),
      ]);

      setClasses(classList.map((item) => ({ id: item.id, name: item.name })));
      setTopics(topicList);
    } catch (error) {
      setRequestError(toErrorMessage(error));
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredTopics = useMemo(
    () => selectedClassId === "all"
      ? topics
      : topics.filter((topic) => topic.class_id === Number(selectedClassId)),
    [topics, selectedClassId],
  );

  const classNameById = useMemo(
    () => new Map(classes.map((item) => [item.id, item.name])),
    [classes],
  );

  const activeTopics = filteredTopics.filter((topic) => topic.status === "active");
  const closedTopics = filteredTopics.filter((topic) => topic.status === "closed");

  const handleCloseTopic = async (topic: BackendTopic) => {
    const confirmed = window.confirm(`Đóng chuyên đề "${topic.title}"?`);
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setRequestError("");

    try {
      await closeTopic(topic.id);
      await loadData();
    } catch (error) {
      setRequestError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 mb-2">Chuyên đề</h1>
          <p className="text-zinc-600">Quản lý chuyên đề và theo dõi tiến độ</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-3 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Thêm chuyên đề
        </button>
      </div>

      {requestError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {requestError}
        </div>
      )}

      <div className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">Chuyên đề đang mở</h2>
          <TopicClassFilter
            classes={classes}
            selectedClassId={selectedClassId}
            onChange={setSelectedClassId}
          />
        </div>
        {activeTopics.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeTopics.map((topic) => {
              const className = classNameById.get(topic.class_id) ?? `Lớp #${topic.class_id}`;

              return (
                <div key={topic.id} className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-zinc-900 mb-1">{topic.title}</h3>
                      <p className="text-sm text-zinc-600">{className}</p>
                    </div>
                    <span className="px-3 py-1 bg-zinc-900 text-white rounded-full text-sm whitespace-nowrap ml-3">
                      Đang mở
                    </span>
                  </div>

                  <div className="space-y-3 mb-4">
                    <a
                      href={topic.gym_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-zinc-700 hover:text-zinc-900 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Xem trên Codeforces
                    </a>

                    <button
                      onClick={() => navigate(`/topics/${topic.id}/standing`)}
                      className="flex items-center gap-2 text-sm text-zinc-700 hover:text-zinc-900 transition-colors"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Xem standing
                    </button>

                    <button
                      onClick={() => void handleCloseTopic(topic)}
                      disabled={submitting}
                      className="flex items-center gap-2 text-sm text-zinc-700 hover:text-zinc-900 transition-colors disabled:opacity-60"
                    >
                      <XCircle className="w-4 h-4" />
                      Đóng chuyên đề
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center shadow-sm">
            <p className="text-zinc-600">Chưa có chuyên đề nào đang mở</p>
          </div>
        )}
      </div>

      {closedTopics.length > 0 && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">Chuyên đề đã đóng</h2>
            <TopicClassFilter
              classes={classes}
              selectedClassId={selectedClassId}
              onChange={setSelectedClassId}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {closedTopics.map((topic) => {
              const className = classNameById.get(topic.class_id) ?? `Lớp #${topic.class_id}`;
              return (
                <div key={topic.id} className="bg-white border border-zinc-200 rounded-xl p-6 opacity-60 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-900 mb-1">{topic.title}</h3>
                      <p className="text-sm text-zinc-600">{className}</p>
                    </div>
                    <span className="px-3 py-1 bg-zinc-200 text-zinc-600 rounded-full text-sm">
                      Đã đóng
                    </span>
                  </div>
                  <div className="space-y-2">
                    <a
                      href={topic.gym_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-zinc-700 hover:text-zinc-900 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Xem trên Codeforces
                    </a>
                    <button
                      onClick={() => navigate(`/topics/${topic.id}/standing`)}
                      className="flex items-center gap-2 text-sm text-zinc-700 hover:text-zinc-900 transition-colors"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Xem standing
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showAddModal && (
        <AddTopicModal
          classes={classes}
          submitting={submitting}
          onClose={() => setShowAddModal(false)}
          onSubmit={async (payload) => {
            setSubmitting(true);
            setRequestError("");

            try {
              await createTopic({
                class_id: payload.class_id,
                gym_link: payload.gym_link,
              });
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
    </div>
  );
}

function TopicClassFilter({
  classes,
  selectedClassId,
  onChange,
}: {
  classes: ClassOption[];
  selectedClassId: string;
  onChange: (classId: string) => void;
}) {
  return (
    <select
      value={selectedClassId}
      onChange={(event) => onChange(event.target.value)}
      className="min-w-48 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
      aria-label="Lọc chuyên đề theo lớp"
    >
      <option value="all">Tất cả lớp</option>
      {classes.map((cls) => (
        <option key={cls.id} value={cls.id}>{cls.name}</option>
      ))}
    </select>
  );
}

function AddTopicModal({
  classes,
  submitting,
  onClose,
  onSubmit,
}: {
  classes: ClassOption[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { class_id: number; gym_link: string }) => Promise<void>;
}) {
  const [classId, setClassId] = useState("");
  const [gymLink, setGymLink] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError("");

    const parsedClassId = Number(classId);
    if (!Number.isInteger(parsedClassId) || parsedClassId <= 0) {
      setLocalError("Vui lòng chọn lớp hợp lệ");
      return;
    }

    const normalizedLink = gymLink.trim();
    if (!normalizedLink) {
      setLocalError("Link GYM là bắt buộc");
      return;
    }

    await onSubmit({
      class_id: parsedClassId,
      gym_link: normalizedLink,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-zinc-200 rounded-xl p-6 w-full max-w-md shadow-lg">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm text-zinc-700 mb-2">Lớp</label>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">Chọn lớp</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-700 mb-2">Link GYM Contest</label>
            <input
              type="url"
              value={gymLink}
              onChange={(event) => setGymLink(event.target.value)}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="https://codeforces.com/gym/123456"
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
              className="flex-1 px-4 py-3 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium"
            >
              {submitting ? "Đang thêm..." : "Thêm chuyên đề"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
