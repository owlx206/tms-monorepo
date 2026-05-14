export type CreateStudentCommand = {
  teacherId: number;
  fullName: string;
  classId: number;
  codeforcesHandle: string;
  phone: string | null;
  note: string | null;
  enrolledAt: Date;
};
