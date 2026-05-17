import config from '../../../../config.js';
import { DiscordClient } from '../../../../infrastructure/external/discord/discord-api.service.js';
import { AuthError } from '../../../../shared/errors/auth.error.js';
import { ServiceError } from '../../../../shared/errors/service.error.js';
import type { SysadminDiscordBotCredentialStore } from '../../infrastructure/persistence/typeorm/SysadminDiscordBotCredentialStore.js';
import {
  exchangeStudentDiscordCode,
  fetchStudentDiscordUser,
} from '../../infrastructure/discord/DiscordStudentOAuth.js';
import { verifyStudentDiscordAuthorizationState } from '../../infrastructure/discord/StudentDiscordAuthorizationState.js';
import type { TypeOrmStudentDiscordIdentityStore } from '../../infrastructure/persistence/typeorm/TypeOrmStudentDiscordIdentityStore.js';

export class CompleteStudentDiscordAuthorizationUseCase {
  constructor(
    private readonly repository: TypeOrmStudentDiscordIdentityStore,
    private readonly discordBotCredentialStore: SysadminDiscordBotCredentialStore,
  ) {}

  async execute(input: {
    code?: string;
    state?: string;
    error?: string;
  }): Promise<string> {
    if (input.error) {
      return 'cancelled';
    }

    if (!input.code || !input.state) {
      throw new AuthError('student discord authorization callback is missing required parameters', 400);
    }

    const credential = await this.discordBotCredentialStore.findDefault();
    if (!credential?.client_id || !credential.client_secret || !credential.bot_token) {
      throw new AuthError('discord is not available right now', 503);
    }

    const authState = verifyStudentDiscordAuthorizationState(input.state);
    const redirectUri = `${config.backendPublicUrl}${config.apiPrefix}/discord/student/callback`;
    const tokenSet = await exchangeStudentDiscordCode({
      code: input.code,
      clientId: credential.client_id,
      clientSecret: credential.client_secret,
      redirectUri,
    });
    const discordUser = await fetchStudentDiscordUser(tokenSet.accessToken);

    await this.repository.updateStudentDiscordAuthorization({
      teacherId: authState.teacher_id,
      studentId: authState.student_id,
      discordUserId: discordUser.id,
      discordUsername: discordUser.username,
      accessToken: tokenSet.accessToken,
      refreshToken: tokenSet.refreshToken,
      tokenExpiresAt: tokenSet.expiresAt,
      authorizedAt: new Date(),
    });

    const classGuild = await this.repository.getActiveClassDiscordBinding(authState.teacher_id, authState.student_id);
    if (!classGuild) {
      return 'authorized_no_class_guild';
    }

    try {
      await new DiscordClient(credential.bot_token).addGuildMember({
        guildId: classGuild.discord_guild_id,
        userId: discordUser.id,
        userAccessToken: tokenSet.accessToken,
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        return 'authorized_join_failed';
      }
      throw error;
    }

    return 'success';
  }
}
