import { ServiceError } from '../../../../shared/errors/service.error.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type {
  StudentMessageInput,
  ChannelPostInput,
  SelectClassDiscordGuildInput,
} from '../../application/dto/MessagingDto.js';
import { getClassId, getTeacherId } from './request-context.js';

type MessagingControllerAction =
  | 'listDiscordGuilds'
  | 'listDiscordGuildChannels'
  | 'completeDiscordInstall'
  | 'getBotInviteLink'
  | 'getSetupStatus'
  | 'upsertClassDiscordBinding'
  | 'unbindClassDiscordBinding'
  | 'sendStudentMessages'
  | 'sendChannelPost';

type MessagingControllerDependencies = {
  listDiscordGuilds(teacherId: number): Promise<unknown>;
  listDiscordGuildChannels(teacherId: number, guildId: number): Promise<unknown>;
  completeDiscordInstall(input: {
    code?: string;
    state?: string;
    guild_id?: string;
    error?: string;
  }): Promise<string>;
  getBotInviteLink(teacherId: number): Promise<unknown> | unknown;
  getSetupStatus(teacherId: number): Promise<unknown>;
  upsertDiscordGuildByClass(
    teacherId: number,
    classId: number,
    input: SelectClassDiscordGuildInput,
  ): Promise<unknown>;
  unbindDiscordGuildByClass(teacherId: number, classId: number): Promise<unknown>;
  sendStudentMessages(teacherId: number, input: StudentMessageInput): Promise<unknown>;
  sendChannelPost(teacherId: number, input: ChannelPostInput): Promise<unknown>;
};

type MessagingHttpRequest = HttpRequest<
  SelectClassDiscordGuildInput | StudentMessageInput | ChannelPostInput,
  { classId?: number; guildId?: number; studentId?: number },
  { code?: string; state?: string; guild_id?: string; error?: string }
>;

export class MessagingController implements Controller {
  constructor(
    private readonly action: MessagingControllerAction,
    private readonly dependencies: MessagingControllerDependencies,
  ) {}

  async handle(request: MessagingHttpRequest): Promise<HttpResponse> {
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
        case 'getSetupStatus':
          return this.getSetupStatus(request);
        case 'upsertClassDiscordBinding':
          return this.upsertClassDiscordBinding(request);
        case 'unbindClassDiscordBinding':
          return this.unbindClassDiscordBinding(request);
        case 'sendStudentMessages':
          return this.sendStudentMessages(request);
        case 'sendChannelPost':
          return this.sendChannelPost(request);
      }
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }

      throw error;
    }
  }

  private async listDiscordGuilds(request: MessagingHttpRequest): Promise<HttpResponse> {
    const guilds = await this.dependencies.listDiscordGuilds(getTeacherId(request));

    return {
      statusCode: 200,
      body: { guilds },
    };
  }

  private async listDiscordGuildChannels(request: MessagingHttpRequest): Promise<HttpResponse> {
    const guildId = (request.params as { guildId?: number }).guildId;

    if (typeof guildId !== 'number') {
      throw new ServiceError('guildId is required', 400);
    }

    const channels = await this.dependencies.listDiscordGuildChannels(getTeacherId(request), guildId);

    return {
      statusCode: 200,
      body: { channels },
    };
  }

  private async completeDiscordInstall(request: MessagingHttpRequest): Promise<HttpResponse> {
    const redirectUrl = await this.dependencies.completeDiscordInstall(
      (request.query ?? {}) as {
        code?: string;
        state?: string;
        guild_id?: string;
        error?: string;
      },
    );

    return {
      statusCode: 302,
      body: {
        redirect_to: redirectUrl,
      },
      headers: {
        Location: redirectUrl,
      },
    };
  }

  private async getBotInviteLink(request: MessagingHttpRequest): Promise<HttpResponse> {
    const inviteLink = await this.dependencies.getBotInviteLink(getTeacherId(request));

    return {
      statusCode: 200,
      body: { invite_link: inviteLink },
    };
  }

  private async getSetupStatus(request: MessagingHttpRequest): Promise<HttpResponse> {
    const status = await this.dependencies.getSetupStatus(getTeacherId(request));

    return {
      statusCode: 200,
      body: status,
    };
  }

  private async upsertClassDiscordBinding(request: MessagingHttpRequest): Promise<HttpResponse> {
      const binding = await this.dependencies.upsertDiscordGuildByClass(
        getTeacherId(request),
        getClassId(request),
        request.body as SelectClassDiscordGuildInput,
      );

    return {
      statusCode: 200,
      body: { binding },
    };
  }

  private async unbindClassDiscordBinding(request: MessagingHttpRequest): Promise<HttpResponse> {
    await this.dependencies.unbindDiscordGuildByClass(
      getTeacherId(request),
      getClassId(request),
    );

    return {
      statusCode: 200,
      body: { binding: null },
    };
  }

  private async sendStudentMessages(request: MessagingHttpRequest): Promise<HttpResponse> {
    const result = await this.dependencies.sendStudentMessages(
      getTeacherId(request),
      request.body as StudentMessageInput,
    );

    return {
      statusCode: 201,
      body: result,
    };
  }

  private async sendChannelPost(request: MessagingHttpRequest): Promise<HttpResponse> {
    const result = await this.dependencies.sendChannelPost(
      getTeacherId(request),
      request.body as ChannelPostInput,
    );

    return {
      statusCode: 201,
      body: result,
    };
  }
}
