export type StudentDiscordInviteResult = {
  sent: boolean;
  reason: string | null;
};

export interface StudentCommunityPort {
  onStudentEnrolled(teacherId: number, studentId: number, classId: number): Promise<void>;
  onStudentTransferred(teacherId: number, studentId: number, newClassId: number): Promise<void>;
  onStudentWithdrawn(teacherId: number, studentId: number): Promise<void>;
  inviteStudentToCurrentClass(teacherId: number, studentId: number): Promise<StudentDiscordInviteResult>;
}
