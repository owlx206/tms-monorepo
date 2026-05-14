export type UpdateStudentCommand = {
  teacherId: number;
  studentId: number;
  fullName?: string;
  codeforcesHandle?: string;
  phone?: string | null;
  note?: string | null;
};
