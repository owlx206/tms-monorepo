export type StudentStatus = 'active' | 'pending_archive' | 'archived';

export interface Student {
  id: string;
  name: string;
  classId: string;
  status: StudentStatus;
  balance: number;
  joinedDate: string;
  codeforcesHandle?: string;
}

export interface Class {
  id: string;
  name: string;
  schedule: string;
  feePerSession: number;
  status: 'active' | 'archived';
  studentCount: number;
}

export interface Session {
  id: string;
  classId: string;
  date: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

export interface Attendance {
  id: string;
  sessionId: string;
  studentId: string;
  status: 'present' | 'absent' | 'excused';
  approvedReason?: string;
}

export interface Transaction {
  id: string;
  studentId: string;
  amount: number;
  type: 'fee' | 'payment' | 'refund';
  date: string;
  description: string;
  sessionId?: string;
}

export interface Topic {
  id: string;
  classId: string;
  name: string;
  gymLink: string;
  status: 'active' | 'closed';
}

export const mockStudents: Student[] = [
  {
    id: '1',
    name: 'Nguyễn Văn A',
    classId: '1',
    status: 'active',
    balance: -500000,
    joinedDate: '2026-01-15',
    codeforcesHandle: 'user_a',
  },
  {
    id: '2',
    name: 'Trần Thị B',
    classId: '1',
    status: 'active',
    balance: 200000,
    joinedDate: '2026-02-01',
    codeforcesHandle: 'user_b',
  },
  {
    id: '3',
    name: 'Lê Văn C',
    classId: '2',
    status: 'active',
    balance: -300000,
    joinedDate: '2026-01-10',
    codeforcesHandle: 'user_c',
  },
  {
    id: '4',
    name: 'Phạm Thị D',
    classId: '2',
    status: 'pending_archive',
    balance: -150000,
    joinedDate: '2025-12-01',
  },
  {
    id: '5',
    name: 'Hoàng Văn E',
    classId: '1',
    status: 'pending_archive',
    balance: 100000,
    joinedDate: '2025-11-15',
  },
];

export const mockClasses: Class[] = [
  {
    id: '1',
    name: 'Lớp Cơ Bản',
    schedule: 'Thứ 3, 5, 7 - 19:00',
    feePerSession: 150000,
    status: 'active',
    studentCount: 8,
  },
  {
    id: '2',
    name: 'Lớp Nâng Cao',
    schedule: 'Thứ 2, 4, 6 - 20:00',
    feePerSession: 200000,
    status: 'active',
    studentCount: 6,
  },
  {
    id: '3',
    name: 'Lớp Chuyên Sâu',
    schedule: 'Chủ nhật - 14:00',
    feePerSession: 250000,
    status: 'archived',
    studentCount: 0,
  },
];

export const mockTransactions: Transaction[] = [
  {
    id: '1',
    studentId: '1',
    amount: -150000,
    type: 'fee',
    date: '2026-04-15',
    description: 'Học phí buổi 1',
    sessionId: 's1',
  },
  {
    id: '2',
    studentId: '1',
    amount: 500000,
    type: 'payment',
    date: '2026-04-10',
    description: 'Nộp học phí tháng 4',
  },
  {
    id: '3',
    studentId: '2',
    amount: -200000,
    type: 'fee',
    date: '2026-04-16',
    description: 'Học phí buổi 2',
    sessionId: 's2',
  },
];

export const mockTopics: Topic[] = [
  {
    id: '1',
    classId: '1',
    name: 'Graph Theory Basics',
    gymLink: 'https://codeforces.com/gym/123456',
    status: 'active',
  },
  {
    id: '2',
    classId: '1',
    name: 'Dynamic Programming',
    gymLink: 'https://codeforces.com/gym/123457',
    status: 'active',
  },
  {
    id: '3',
    classId: '2',
    name: 'Advanced Trees',
    gymLink: 'https://codeforces.com/gym/123458',
    status: 'closed',
  },
];
