import type {
  StudentDiscordMembershipPort,
  StudentDiscordInviteResult,
} from '../../../application/ports/StudentDiscordMembershipPort.js';

const discordAutomationNotConfigured: StudentDiscordInviteResult = {
  sent: false,
  reason: 'Discord automation is not configured',
};

export class StudentDiscordMembershipNotifier {
  constructor(private readonly studentDiscordMembershipPort?: StudentDiscordMembershipPort) {}

  inviteStudentToCurrentClass(input: {
    teacherId: number;
    studentId: number;
  }): Promise<StudentDiscordInviteResult> {
    return this.studentDiscordMembershipPort?.inviteStudentToCurrentClass(
      input.teacherId,
      input.studentId,
    ) ?? Promise.resolve(discordAutomationNotConfigured);
  }

  studentEnrolled(teacherId: number, studentId: number, classId: number): void {
    void this.studentDiscordMembershipPort?.onStudentEnrolled(teacherId, studentId, classId).catch(() => {});
  }

  studentTransferred(teacherId: number, studentId: number, toClassId: number): void {
    void this.studentDiscordMembershipPort?.onStudentTransferred(teacherId, studentId, toClassId).catch(() => {});
  }

  studentWithdrawn(teacherId: number, studentId: number): void {
    void this.studentDiscordMembershipPort?.onStudentWithdrawn(teacherId, studentId).catch(() => {});
  }
}
