import { HttpError } from '../../../../shared/errors/HttpError.js';
import type {
  DiscordBotCredentialStore,
  TypeOrmStudentDiscordIdentityStore,
} from '../../../account/infrastructure/persistence/typeorm/Writer.js';
import {
  exchangeStudentDiscordCode,
  fetchStudentDiscordUser,
  signStudentDiscordAuthorizationState,
  verifyStudentDiscordAuthorizationState,
  discordApiUrl,
} from '../../../../infrastructure/security/discord-oauth.js';

export class AuthorizeStudentDiscord {
  constructor(
    private readonly repository: TypeOrmStudentDiscordIdentityStore,
    private readonly credentialStore: DiscordBotCredentialStore,
  ) {}

  async buildAuthorizeUrl(teacherId: number, studentId: number): Promise<string> {
    const credential = await this.credentialStore.findDefault();
    if (!credential?.client_id || !credential.client_secret) {
      throw new HttpError('discord is not available right now', 503);
    }

    if (!await this.repository.studentExists(teacherId, studentId)) {
      throw new HttpError('student not found', 404);
    }

    const search = new URLSearchParams({
      client_id: credential.client_id,
      response_type: 'code',
      redirect_uri: discordApiUrl('/discord/student/callback'),
      scope: 'identify guilds.join',
      state: signStudentDiscordAuthorizationState({
        teacher_id: teacherId,
        student_id: studentId,
      }),
    });

    return `https://discord.com/oauth2/authorize?${search.toString()}`;
  }

  async handleCallback(input: { code?: string; state?: string; error?: string }): Promise<string> {
    if (input.error) {
      return 'cancelled';
    }

    if (!input.code || !input.state) {
      throw new HttpError('student discord authorization callback is missing required parameters', 400);
    }

    const credential = await this.credentialStore.findDefault();
    if (!credential?.client_id || !credential.client_secret) {
      throw new HttpError('discord is not available right now', 503);
    }

    const authState = verifyStudentDiscordAuthorizationState(input.state);

    const redirectUri = discordApiUrl('/discord/student/callback');
    const tokenSet = await exchangeStudentDiscordCode({
      code: input.code,
      clientId: credential.client_id,
      clientSecret: credential.client_secret,
      redirectUri,
    });
    const discordUser = await fetchStudentDiscordUser(tokenSet.accessToken);

    const updated = await this.repository.updateStudentDiscordAuthorization({
      teacherId: authState.teacher_id,
      studentId: authState.student_id,
      discordUserId: discordUser.id,
      discordUsername: discordUser.username,
      accessToken: tokenSet.accessToken,
      refreshToken: tokenSet.refreshToken,
      tokenExpiresAt: tokenSet.expiresAt,
      authorizedAt: new Date(),
    });
    if (!updated) {
      return 'unauthorized';
    }

    return 'success';
  }
}
