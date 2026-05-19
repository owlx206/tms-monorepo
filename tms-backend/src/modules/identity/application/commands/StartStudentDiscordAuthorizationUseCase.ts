import config from '../../../../config.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { SysadminDiscordBotCredentialStore } from '../../infrastructure/persistence/typeorm/Writer.js';
import type { TypeOrmStudentDiscordIdentityStore } from '../../infrastructure/persistence/typeorm/Writer.js';
import { signStudentDiscordAuthorizationState } from '../../infrastructure/discord/StudentDiscordAuthorizationState.js';

export class StartStudentDiscordAuthorizationUseCase {
  constructor(
    private readonly repository: TypeOrmStudentDiscordIdentityStore,
    private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore,
  ) {}

  async execute(teacherId: number, studentId: number): Promise<string> {
    const credential = await this.discordBotCredentialStore.findDefault();
    if (!credential?.client_id || !credential.client_secret) {
      throw new HttpError('discord is not available right now', 503);
    }

    if (!await this.repository.studentExists(teacherId, studentId)) {
      throw new HttpError('student not found', 404);
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
