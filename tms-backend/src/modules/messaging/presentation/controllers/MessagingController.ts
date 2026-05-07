import { ServiceError } from '../../../../shared/errors/service.error.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type {
  BulkDmInput,
  ChannelPostInput,
  MessageListFilters,
  SelectClassDiscordServerInput,
  UpsertCommunityServerInput,
} from '../../application/dto/MessagingDto.js';
import { getClassId, getTeacherId } from './request-context.js';

type MessagingControllerAction =
  | 'listDiscordServers'
  | 'syncDiscordServers'
  | 'listDiscordChannels'
  | 'completeDiscordInstall'
  | 'getCommunityServer'
  | 'upsertCommunityServer'
  | 'deleteCommunityServer'
  | 'getBotInviteLink'
  | 'getSetupStatus'
  | 'upsertDiscordServer'
  | 'deleteDiscordServer'
  | 'listMessages'
  | 'sendBulkDm'
  | 'sendChannelPost';

type MessagingControllerDependencies = {
  listDiscordServers(teacherId: number): Promise<unknown>;
  syncDiscordServers(teacherId: number): Promise<unknown>;
  listDiscordChannels(teacherId: number, serverId: number): Promise<unknown>;
  completeDiscordInstall(input: {
    code?: string;
    state?: string;
    guild_id?: string;
    error?: string;
  }): Promise<string>;
  getCommunityServer(teacherId: number): Promise<unknown>;
  upsertCommunityServer(teacherId: number, input: UpsertCommunityServerInput): Promise<unknown>;
  deleteCommunityServer(teacherId: number): Promise<unknown>;
  getBotInviteLink(teacherId: number): Promise<unknown> | unknown;
  getSetupStatus(teacherId: number): Promise<unknown>;
  upsertDiscordServerByClass(
    teacherId: number,
    classId: number,
    input: SelectClassDiscordServerInput,
  ): Promise<unknown>;
  deleteDiscordServer(teacherId: number, classId: number): Promise<unknown>;
  listMessages(teacherId: number, filters: MessageListFilters): Promise<unknown>;
  sendBulkDm(teacherId: number, input: BulkDmInput): Promise<unknown>;
  sendChannelPost(teacherId: number, input: ChannelPostInput): Promise<unknown>;
};

type MessagingHttpRequest = HttpRequest<
  SelectClassDiscordServerInput | UpsertCommunityServerInput | BulkDmInput | ChannelPostInput,
  { classId?: number; serverId?: number },
  MessageListFilters
>;

export class MessagingController implements Controller {
  constructor(
    private readonly action: MessagingControllerAction,
    private readonly dependencies: MessagingControllerDependencies,
  ) {}

  async handle(request: MessagingHttpRequest): Promise<HttpResponse> {
    try {
      switch (this.action) {
        case 'listDiscordServers':
          return this.listDiscordServers(request);
        case 'syncDiscordServers':
          return this.syncDiscordServers(request);
        case 'listDiscordChannels':
          return this.listDiscordChannels(request);
        case 'completeDiscordInstall':
          return this.completeDiscordInstall(request);
        case 'getCommunityServer':
          return this.getCommunityServer(request);
        case 'upsertCommunityServer':
          return this.upsertCommunityServer(request);
        case 'deleteCommunityServer':
          return this.deleteCommunityServer(request);
        case 'getBotInviteLink':
          return this.getBotInviteLink(request);
        case 'getSetupStatus':
          return this.getSetupStatus(request);
        case 'upsertDiscordServer':
          return this.upsertDiscordServer(request);
        case 'deleteDiscordServer':
          return this.deleteDiscordServer(request);
        case 'listMessages':
          return this.listMessages(request);
        case 'sendBulkDm':
          return this.sendBulkDm(request);
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

  private async listDiscordServers(request: MessagingHttpRequest): Promise<HttpResponse> {
    const servers = await this.dependencies.listDiscordServers(getTeacherId(request));

    return {
      statusCode: 200,
      body: { servers },
    };
  }

  private async syncDiscordServers(request: MessagingHttpRequest): Promise<HttpResponse> {
    const result = await this.dependencies.syncDiscordServers(getTeacherId(request));

    return {
      statusCode: 200,
      body: result,
    };
  }

  private async listDiscordChannels(request: MessagingHttpRequest): Promise<HttpResponse> {
    const serverId = (request.params as { serverId?: number }).serverId;

    if (typeof serverId !== 'number') {
      throw new ServiceError('serverId is required', 400);
    }

    const channels = await this.dependencies.listDiscordChannels(getTeacherId(request), serverId);

    return {
      statusCode: 200,
      body: { channels },
    };
  }

  private async getCommunityServer(request: MessagingHttpRequest): Promise<HttpResponse> {
    const server = await this.dependencies.getCommunityServer(getTeacherId(request));

    return {
      statusCode: 200,
      body: { server },
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

  private async upsertCommunityServer(request: MessagingHttpRequest): Promise<HttpResponse> {
    const server = await this.dependencies.upsertCommunityServer(
      getTeacherId(request),
      request.body as UpsertCommunityServerInput,
    );

    return {
      statusCode: 200,
      body: { server },
    };
  }

  private async deleteCommunityServer(request: MessagingHttpRequest): Promise<HttpResponse> {
    const result = await this.dependencies.deleteCommunityServer(getTeacherId(request));

    return {
      statusCode: 200,
      body: result,
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

  private async upsertDiscordServer(request: MessagingHttpRequest): Promise<HttpResponse> {
      const server = await this.dependencies.upsertDiscordServerByClass(
        getTeacherId(request),
        getClassId(request),
        request.body as SelectClassDiscordServerInput,
      );

    return {
      statusCode: 200,
      body: { server },
    };
  }

  private async deleteDiscordServer(request: MessagingHttpRequest): Promise<HttpResponse> {
    const result = await this.dependencies.deleteDiscordServer(
      getTeacherId(request),
      getClassId(request),
    );

    return {
      statusCode: 200,
      body: result,
    };
  }

  private async listMessages(request: MessagingHttpRequest): Promise<HttpResponse> {
    const messages = await this.dependencies.listMessages(
      getTeacherId(request),
      (request.query ?? {}) as MessageListFilters,
    );

    return {
      statusCode: 200,
      body: { messages },
    };
  }

  private async sendBulkDm(request: MessagingHttpRequest): Promise<HttpResponse> {
    const result = await this.dependencies.sendBulkDm(
      getTeacherId(request),
      request.body as BulkDmInput,
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
