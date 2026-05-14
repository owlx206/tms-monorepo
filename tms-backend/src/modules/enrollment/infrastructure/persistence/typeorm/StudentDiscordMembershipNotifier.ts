import type {
  StudentDiscordInviteResult,
  TypeOrmStudentDiscordMembershipService,
} from './TypeOrmStudentDiscordMembershipService.js';

const discordAutomationNotConfigured: StudentDiscordInviteResult = {
  sent: false,
  reason: 'Discord automation is not configured',
};

export class StudentDiscordMembershipNotifier {
  constructor(private readonly studentDiscordMembershipService?: TypeOrmStudentDiscordMembershipService) {}

  inviteStudentToCurrentClass(input: {
    teacherId: number;
    studentId: number;
  }): Promise<StudentDiscordInviteResult> {
    return this.studentDiscordMembershipService?.inviteStudentToCurrentClass(
      input.teacherId,
      input.studentId,
    ) ?? Promise.resolve(discordAutomationNotConfigured);
  }

  studentEnrolled(
    teacherId: number,
    studentId: number,
    classId: number,
  ): Promise<StudentDiscordInviteResult> {
    return this.studentDiscordMembershipService?.onStudentEnrolled(
      teacherId,
      studentId,
      classId,
    ) ?? Promise.resolve(discordAutomationNotConfigured);
  }

  studentTransferred(
    teacherId: number,
    studentId: number,
    toClassId: number,
  ): Promise<StudentDiscordInviteResult> {
    return this.studentDiscordMembershipService?.onStudentTransferred(
      teacherId,
      studentId,
      toClassId,
    ) ?? Promise.resolve(discordAutomationNotConfigured);
  }

  studentWithdrawn(teacherId: number, studentId: number): void {
    void this.studentDiscordMembershipService?.onStudentWithdrawn(teacherId, studentId).catch(() => {});
  }
}
