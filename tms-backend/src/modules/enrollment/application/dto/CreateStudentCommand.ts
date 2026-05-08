export type CreateStudentCommand = {
  teacherId: number;
  fullName: string;
  classId: number;
  codeforcesHandle: string | null;
  discordUsername: string | null;
  discordUserId: string | null;
  phone: string | null;
  note: string | null;
  enrolledAt: Date;
};
