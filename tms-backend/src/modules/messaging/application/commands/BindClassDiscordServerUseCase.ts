import { ServiceError } from '../../../../shared/errors/service.error.js';
import type { SelectClassDiscordServerInput } from '../dto/MessagingDto.js';
import type { MessagingWriteRepository } from '../../infrastructure/persistence/typeorm/MessagingWriteRepository.js';

export class BindClassDiscordServerUseCase {
  constructor(private readonly messagingWriteRepository: MessagingWriteRepository) {}

  async execute(teacherId: number, classId: number, input: SelectClassDiscordServerInput) {
    const serverCache = await this.messagingWriteRepository.findTeacherDiscordServerCacheById(
      teacherId,
      input.server_id,
    );

    if (!serverCache) {
      throw new ServiceError('selected server is invalid', 404);
    }

    const notificationChannel = input.notification_channel_id
      ? await this.messagingWriteRepository.findTeacherDiscordChannelCacheById(teacherId, Number(input.notification_channel_id))
      : null;
    const voiceChannel = input.attendance_voice_channel_id
      ? await this.messagingWriteRepository.findTeacherDiscordChannelCacheById(teacherId, Number(input.attendance_voice_channel_id))
      : null;

    if (notificationChannel && notificationChannel.discord_server_id !== serverCache.discord_server_id) {
      throw new ServiceError('notification channel does not belong to selected server', 400);
    }

    if (notificationChannel && notificationChannel.type !== 'text') {
      throw new ServiceError('notification channel must be a text channel', 400);
    }

    if (voiceChannel && voiceChannel.discord_server_id !== serverCache.discord_server_id) {
      throw new ServiceError('voice channel does not belong to selected server', 400);
    }

    if (voiceChannel && voiceChannel.type !== 'voice') {
      throw new ServiceError('voice channel must be a voice channel', 400);
    }

    const communityBound = await this.messagingWriteRepository.hasCommunityServerByDiscordServerId(
      teacherId,
      serverCache.discord_server_id,
    );
    if (communityBound) {
      throw new ServiceError('selected server is already bound as community server', 409);
    }

    const existing = await this.messagingWriteRepository.findDiscordServerByClass(teacherId, classId);
    const existingByServer = await this.messagingWriteRepository.findDiscordServerByDiscordServerId(
      teacherId,
      serverCache.discord_server_id,
    );

    if (existingByServer && existingByServer.class_id !== classId) {
      throw new ServiceError('selected server is already bound to another class', 409);
    }

    if (existing) {
      if (existing.discord_server_id !== serverCache.discord_server_id) {
        throw new ServiceError('current class already has another server binding', 409);
      }

      existing.discord_server_id = serverCache.discord_server_id;
      existing.name = serverCache.name;
      existing.notification_channel_id = notificationChannel?.discord_channel_id ?? null;
      existing.attendance_voice_channel_id = voiceChannel?.discord_channel_id ?? null;
      return this.messagingWriteRepository.saveDiscordServer(existing);
    }

    return this.messagingWriteRepository.saveDiscordServer(
      this.messagingWriteRepository.createDiscordServer({
        teacher_id: teacherId,
        class_id: classId,
        discord_server_id: serverCache.discord_server_id,
        name: serverCache.name,
        notification_channel_id: notificationChannel?.discord_channel_id ?? null,
        attendance_voice_channel_id: voiceChannel?.discord_channel_id ?? null,
        bot_token: null,
      }),
    );
  }
}
