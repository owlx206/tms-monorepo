import { HttpError } from '../../../../shared/errors/HttpError.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type { ParsedRequestContext } from '../../../../infrastructure/http/request-context.js';
import { TypeOrmDiscordCacheStore } from '../../../../infrastructure/external/discord/cache/discord-cache.store.js';
import {
  discordFrontendUrl,
  verifyDiscordInstallState,
} from '../../../identity/infrastructure/auth/discord-oauth.js';
import type { ChannelPostInput, SelectClassDiscordGuildInput } from '../../contracts/types.js';

type ClassDiscordControllerAction =
  | 'listDiscordGuilds'
  | 'listDiscordGuildChannels'
  | 'completeDiscordInstall'
  | 'getBotInviteLink'
  | 'upsertClassDiscordBinding'
  | 'unbindClassDiscordBinding'
  | 'sendChannelPost';

type ClassDiscordControllerDependencies = {
  listDiscordGuilds: { execute(teacherId: number): Promise<unknown> };
  listDiscordGuildChannels: { execute(teacherId: number, discordGuildId: string): Promise<unknown> };
  discordCache: TypeOrmDiscordCacheStore;
  getBotInviteLink: { execute(teacherId: number): Promise<unknown> };
  upsertDiscordGuildByClass: {
    execute(teacherId: number, classId: number, input: SelectClassDiscordGuildInput): Promise<unknown>;
  };
  unbindDiscordGuildByClass: { execute(teacherId: number, classId: number): Promise<unknown> };
  sendChannelPost: { execute(teacherId: number, input: ChannelPostInput): Promise<unknown> };
};

type ClassDiscordHttpRequest = HttpRequest<
  SelectClassDiscordGuildInput | ChannelPostInput,
  { classId: number; guildId: number },
  { code?: string; state?: string; guild_id?: string; error?: string },
  unknown,
  ParsedRequestContext<
    SelectClassDiscordGuildInput | ChannelPostInput,
    { classId: number; guildId: number },
    { code?: string; state?: string; guild_id?: string; error?: string }
  > & { teacherId: number }
>;

export class ClassDiscordController implements Controller {
  constructor(
    private readonly action: ClassDiscordControllerAction,
    private readonly dependencies: ClassDiscordControllerDependencies,
  ) {}

  async handle(request: ClassDiscordHttpRequest): Promise<HttpResponse> {
    try {
      switch (this.action) {
        case 'listDiscordGuilds':
          return this.listDiscordGuilds(request);
        case 'listDiscordGuildChannels':
          return this.listDiscordGuildChannels(request);
        case 'completeDiscordInstall':
          return this.completeDiscordInstall(request);
        case 'getBotInviteLink':
          return this.getBotInviteLink(request);
        case 'upsertClassDiscordBinding':
          return this.upsertClassDiscordBinding(request);
        case 'unbindClassDiscordBinding':
          return this.unbindClassDiscordBinding(request);
        case 'sendChannelPost':
          return this.sendChannelPost(request);
      }
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw error;
    }
  }

  private async listDiscordGuilds(request: ClassDiscordHttpRequest): Promise<HttpResponse> {
    const guilds = await this.dependencies.listDiscordGuilds.execute(request.context.teacherId);

    return {
      statusCode: 200,
      body: { guilds },
    };
  }

  private async listDiscordGuildChannels(request: ClassDiscordHttpRequest): Promise<HttpResponse> {
    const guilds = await this.dependencies.listDiscordGuilds.execute(request.context.teacherId);
    const guild = (guilds as Array<{ id: number; discord_guild_id: string }>).find(
      (item) => item.id === request.context.params.guildId,
    );
    if (!guild) {
      return {
        statusCode: 200,
        body: { channels: [] },
      };
    }

    const channels = await this.dependencies.listDiscordGuildChannels.execute(
      request.context.teacherId,
      guild.discord_guild_id,
    );

    return {
      statusCode: 200,
      body: { channels },
    };
  }

  private async completeDiscordInstall(request: ClassDiscordHttpRequest): Promise<HttpResponse> {
    const query = (request.query ?? {}) as { state?: string; guild_id?: string; error?: string };
    const redirectUrl = await this.persistDiscordInstallCallback(query);

    return {
      statusCode: 302,
      body: { redirect_to: redirectUrl },
      headers: { Location: redirectUrl },
    };
  }

  private async persistDiscordInstallCallback(input: {
    state?: string;
    guild_id?: string;
    error?: string;
  }): Promise<string> {
    if (input.error) {
      return discordFrontendUrl('/settings?discord_install=cancelled');
    }

    if (!input.state || !input.guild_id) {
      return discordFrontendUrl('/settings?discord_install=invalid_callback');
    }

    let discordUserId: string;
    try {
      discordUserId = verifyDiscordInstallState(input.state).discord_user_id;
    } catch {
      return discordFrontendUrl('/settings?discord_install=invalid_state');
    }

    const existingUserGuild = await this.dependencies.discordCache.findAnyGuildByDiscordGuildId(
      input.guild_id,
    );
    if (existingUserGuild && existingUserGuild.discord_user_id !== discordUserId) {
      return discordFrontendUrl('/settings?discord_install=conflict');
    }

    const existing = await this.dependencies.discordCache.findGuildByOwnerAndDiscordGuildId(
      discordUserId,
      input.guild_id,
    );
    const userGuild = existing ?? this.dependencies.discordCache.createGuild({
      discord_user_id: discordUserId,
      discord_guild_id: input.guild_id,
    });
    userGuild.name = null;
    userGuild.synced_at = null;
    await this.dependencies.discordCache.saveGuild(userGuild);

    return discordFrontendUrl('/settings?discord_install=success');
  }

  private async getBotInviteLink(request: ClassDiscordHttpRequest): Promise<HttpResponse> {
    const inviteLink = await this.dependencies.getBotInviteLink.execute(request.context.teacherId);

    return {
      statusCode: 200,
      body: { invite_link: inviteLink },
    };
  }

  private async upsertClassDiscordBinding(request: ClassDiscordHttpRequest): Promise<HttpResponse> {
    const binding = await this.dependencies.upsertDiscordGuildByClass.execute(
      request.context.teacherId,
      request.context.params.classId,
      request.body as SelectClassDiscordGuildInput,
    );

    return {
      statusCode: 200,
      body: { binding },
    };
  }

  private async unbindClassDiscordBinding(request: ClassDiscordHttpRequest): Promise<HttpResponse> {
    await this.dependencies.unbindDiscordGuildByClass.execute(
      request.context.teacherId,
      request.context.params.classId,
    );

    return {
      statusCode: 200,
      body: { binding: null },
    };
  }

  private async sendChannelPost(request: ClassDiscordHttpRequest): Promise<HttpResponse> {
    const result = await this.dependencies.sendChannelPost.execute(
      request.context.teacherId,
      request.body as ChannelPostInput,
    );

    return {
      statusCode: 201,
      body: result,
    };
  }
}
