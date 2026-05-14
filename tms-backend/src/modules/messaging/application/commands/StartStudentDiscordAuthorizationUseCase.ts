import config from '../../../../config.js';
import { AuthError } from '../../../../shared/errors/auth.error.js';
import type { SysadminDiscordBotCredentialStore } from '../../../identity/index.js';
import type { TypeOrmMessagingWriter } from '../../infrastructure/persistence/typeorm/TypeOrmMessagingWriter.js';
import { signStudentDiscordAuthorizationState } from '../../infrastructure/discord/StudentDiscordAuthorizationState.js';

export class StartStudentDiscordAuthorizationUseCase {
  constructor(
    private readonly repository: TypeOrmMessagingWriter,
    private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore,
  ) {}

  async execute(teacherId: number, studentId: number): Promise<string> {
    const credential = await this.discordBotCredentialStore.findDefault();
    if (!credential?.client_id || !credential.client_secret) {
      throw new AuthError('discord oauth is not configured by sysadmin', 503);
    }

    const students = await this.repository.listDiscordMembershipSyncStudents(teacherId);
    if (!students.some((student) => student.student_id === studentId)) {
      throw new AuthError('student not found', 404);
    }

    const search = new URLSearchParams({
      client_id: credential.client_id,
      response_type: 'code',
      redirect_uri: `${config.backendPublicUrl}${config.apiPrefix}/discord/student/callback`,
      scope: 'identify guilds.join',
      state: signStudentDiscordAuthorizationState({
        teacher_id: teacherId,
        student_id: studentId,
      }),
    });

    return `https://discord.com/oauth2/authorize?${search.toString()}`;
  }
}
