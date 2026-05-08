import type {
  StudentCommunityPort,
  StudentDiscordInviteResult,
} from '../../../application/ports/StudentCommunityPort.js';

const discordAutomationNotConfigured: StudentDiscordInviteResult = {
  sent: false,
  reason: 'Discord automation is not configured',
};

export class StudentCommunityNotifier {
  constructor(private readonly studentCommunityPort?: StudentCommunityPort) {}

  inviteStudentToCurrentClass(input: {
    teacherId: number;
    studentId: number;
  }): Promise<StudentDiscordInviteResult> {
    return this.studentCommunityPort?.inviteStudentToCurrentClass(
      input.teacherId,
      input.studentId,
    ) ?? Promise.resolve(discordAutomationNotConfigured);
  }

  studentEnrolled(teacherId: number, studentId: number, classId: number): void {
    void this.studentCommunityPort?.onStudentEnrolled(teacherId, studentId, classId).catch(() => {});
  }

  studentTransferred(teacherId: number, studentId: number, toClassId: number): void {
    void this.studentCommunityPort?.onStudentTransferred(teacherId, studentId, toClassId).catch(() => {});
  }

  studentWithdrawn(teacherId: number, studentId: number): void {
    void this.studentCommunityPort?.onStudentWithdrawn(teacherId, studentId).catch(() => {});
  }
}
