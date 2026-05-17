import { useState } from "react";
import { Plus, Send, Server, Users, Hash } from "lucide-react";

interface ClassDiscordBinding {
  id: string;
  name: string;
  serverId: string;
  channelCount: number;
  memberCount: number;
}

const mockServers: ClassDiscordBinding[] = [
  {
    id: '1',
    name: 'CP Training - Lớp Cơ Bản',
    serverId: '123456789',
    channelCount: 3,
    memberCount: 8,
  },
  {
    id: '2',
    name: 'CP Training - Lớp Nâng Cao',
    serverId: '987654321',
    channelCount: 4,
    memberCount: 6,
  },
];

export function Discord() {
  const [showAddServerModal, setShowAddServerModal] = useState(false);
  const [showSendMessageModal, setShowSendMessageModal] = useState(false);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 mb-2">Discord</h1>
          <p className="text-zinc-600">Quản lý Discord guilds và tin nhắn tự động</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddServerModal(true)}
            className="flex items-center gap-2 px-4 py-3 bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Thêm server
          </button>
          <button
            onClick={() => setShowSendMessageModal(true)}
            className="flex items-center gap-2 px-4 py-3 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors"
          >
            <Send className="w-5 h-5" />
            Gửi tin nhắn
          </button>
        </div>
      </div>

      <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {mockServers.map((server) => (
              <div key={server.id} className="bg-white border border-zinc-200 rounded-xl p-6 hover:border-zinc-700 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center">
                    <Server className="w-6 h-6 text-zinc-900" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-zinc-900 mb-1">{server.name}</h3>
                    <p className="text-sm text-zinc-600 font-mono mb-4">ID: {server.serverId}</p>

                    <div className="flex gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-zinc-600" />
                        <span className="text-sm text-zinc-600">{server.channelCount} kênh</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-zinc-600" />
                        <span className="text-sm text-zinc-600">{server.memberCount} thành viên</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors text-sm">
                        Cấu hình bot
                      </button>
                      <button className="px-3 py-1.5 bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors text-sm">
                        Xem channels
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-zinc-900 mb-3">Hướng dẫn</h3>
            <div className="space-y-2 text-sm text-zinc-600">
              <p>1. Tạo Discord guild và bot cho mỗi lớp học</p>
              <p>2. Thêm server ID vào hệ thống để kết nối</p>
              <p>3. Bot sẽ tự động gửi thông báo điểm danh, học phí, nhắc làm bài</p>
              <p>4. Học sinh có thể báo nghỉ có lý do qua Discord</p>
              <p>5. Điểm danh tự động được đẩy từ bot vào hệ thống</p>
            </div>
          </div>
      </div>

      {showAddServerModal && (
        <AddServerModal onClose={() => setShowAddServerModal(false)} />
      )}

      {showSendMessageModal && (
        <SendMessageModal onClose={() => setShowSendMessageModal(false)} />
      )}
    </div>
  );
}

function AddServerModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-6 w-full max-w-md">
        <form className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-600 mb-2">Tên server</label>
            <input
              type="text"
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="CP Training - Lớp Cơ Bản"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-600 mb-2">Discord Server ID</label>
            <input
              type="text"
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="123456789012345678"
            />
            <p className="text-xs text-zinc-600 mt-2">
              Bật Developer Mode trong Discord để copy Server ID
            </p>
          </div>

          <div>
            <label className="block text-sm text-zinc-600 mb-2">Bot Token</label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="••••••••••••••••••••"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-600 mb-2">Lớp liên kết</label>
            <select className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400">
              <option value="">Chọn lớp</option>
              <option value="1">Lớp Cơ Bản</option>
              <option value="2">Lớp Nâng Cao</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors font-medium"
            >
              Thêm server
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SendMessageModal({ onClose }: { onClose: () => void }) {
  const [messageType, setMessageType] = useState<'personal' | 'group'>('personal');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const mockStudentsData = [
    { id: '1', name: 'Nguyễn Văn A', class: 'Lớp Cơ Bản' },
    { id: '2', name: 'Trần Thị B', class: 'Lớp Cơ Bản' },
    { id: '3', name: 'Lê Văn C', class: 'Lớp Nâng Cao' },
    { id: '4', name: 'Phạm Thị D', class: 'Lớp Nâng Cao' },
    { id: '5', name: 'Hoàng Văn E', class: 'Lớp Cơ Bản' },
  ];

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAll = () => {
    setSelectedStudents(mockStudentsData.map(s => s.id));
  };

  const deselectAll = () => {
    setSelectedStudents([]);
  };

  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-600 mb-2">Loại tin nhắn</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMessageType('personal')}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                  messageType === 'personal'
                    ? 'bg-zinc-700 text-zinc-900'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                Cá nhân (Bulk)
              </button>
              <button
                type="button"
                onClick={() => setMessageType('group')}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                  messageType === 'group'
                    ? 'bg-zinc-700 text-zinc-900'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                Nhóm/Lớp
              </button>
            </div>
          </div>

          {messageType === 'personal' ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm text-zinc-600">
                  Chọn học sinh ({selectedStudents.length}/{mockStudentsData.length})
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-xs px-3 py-1.5 bg-zinc-100 text-zinc-700 rounded hover:bg-zinc-200 transition-colors"
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="text-xs px-3 py-1.5 bg-zinc-100 text-zinc-700 rounded hover:bg-zinc-200 transition-colors"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-lg max-h-64 overflow-y-auto">
                {mockStudentsData.map(student => (
                  <label
                    key={student.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-100 cursor-pointer border-b border-zinc-200 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-100"
                    />
                    <div className="flex-1">
                      <p className="text-zinc-900 text-sm">{student.name}</p>
                      <p className="text-zinc-600 text-xs">{student.class}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm text-zinc-600 mb-2">Lớp/Nhóm</label>
              <select className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400">
                <option value="">Chọn lớp</option>
                <option value="1">Lớp Cơ Bản</option>
                <option value="2">Lớp Nâng Cao</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm text-zinc-600 mb-2">Nội dung tin nhắn</label>
            <textarea
              rows={4}
              className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-none"
              placeholder="Nhập nội dung tin nhắn..."
            />
          </div>

          {messageType === 'personal' && selectedStudents.length > 0 && (
            <div className="bg-zinc-100 border border-zinc-700 rounded-lg p-3">
              <p className="text-zinc-700 text-sm">
                💡 Tin nhắn sẽ được gửi riêng đến {selectedStudents.length} học sinh
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors font-medium"
            >
              Gửi tin nhắn
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
