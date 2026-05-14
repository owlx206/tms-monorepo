import { Client, GatewayIntentBits, type VoiceState } from 'discord.js';

import { AppDataSource } from '../../../infrastructure/database/data-source.js';
import {
  Class,
  ClassSchedule,
  ClassStatus,
  DiscordServer,
  Enrollment,
  Session,
  SessionStatus,
  Student,
} from '../../../entities/index.js';
import type { IntervalJob } from '../../../jobs/index.js';
import { ServiceError } from '../../../shared/errors/service.error.js';
import { UpsertBotSessionAttendanceUseCase } from '../application/commands/UpsertBotSessionAttendanceUseCase.js';
import { TypeOrmAttendanceRepository } from '../infrastructure/persistence/typeorm/TypeOrmAttendanceRepository.js';
import { TypeOrmSessionFinanceService } from '../infrastructure/persistence/typeorm/TypeOrmSessionFinanceService.js';

type OpenVoiceAttendanceSession = {
  teacher_id: number;
  class_id: number;
  session_id: number;
  discord_server_id: string;
  attendance_voice_channel_id: string;
  bot_token: string;
};

type VoiceMemberIdentity = {
  user_id: string;
  username: string | null;
  global_name: string | null;
  discriminator: string | null;
  nick: string | null;
};

type VoiceAttendanceClientState = {
  client: Client;
  tokenKey: string;
  ready: boolean;
};

const DEFAULT_SYNC_INTERVAL_MS = 15_000;

const clientByToken = new Map<string, VoiceAttendanceClientState>();

function currentTimeString(now: Date): string {
  return [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join(':');
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function tokenKey(botToken: string): string {
  return botToken.slice(-12);
}

function normalizeDiscordIdentity(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/^@+/, '');
  return normalized && normalized.length > 0 ? normalized : null;
}

function identityCandidates(identity: VoiceMemberIdentity): Set<string> {
  const candidates = new Set<string>();
  const values = [
    identity.user_id,
    identity.username,
    identity.global_name,
    identity.nick,
    identity.username && identity.discriminator && identity.discriminator !== '0'
      ? `${identity.username}#${identity.discriminator}`
      : null,
  ];

  values.forEach((value) => {
    const normalized = normalizeDiscordIdentity(value);
    if (normalized) {
      candidates.add(normalized);
    }
  });

  return candidates;
}

function studentDiscordKey(student: Student): string | null {
  return normalizeDiscordIdentity(student.discord_username);
}

function identityFromVoiceState(voiceState: VoiceState): VoiceMemberIdentity | null {
  const user = voiceState.member?.user;
  if (!user) {
    return null;
  }

  return {
    user_id: user.id,
    username: user.username,
    global_name: user.globalName,
    discriminator: user.discriminator,
    nick: voiceState.member?.nickname ?? null,
  };
}

async function getOpenVoiceAttendanceSessions(now: Date): Promise<OpenVoiceAttendanceSession[]> {
  const rows = await AppDataSource.getRepository(Session)
    .createQueryBuilder('session')
    .innerJoin(Class, 'class', 'class.id = session.class_id AND class.teacher_id = session.teacher_id')
    .innerJoin(
      ClassSchedule,
      'schedule',
      `
        schedule.teacher_id = session.teacher_id
        AND schedule.class_id = session.class_id
        AND schedule.day_of_week = :dayOfWeek
        AND schedule.start_time <= :timeOfDay
        AND schedule.end_time > :timeOfDay
      `,
    )
    .innerJoin(
      DiscordServer,
      'discord_server',
      'discord_server.teacher_id = session.teacher_id AND discord_server.class_id = session.class_id',
    )
    .select('session.teacher_id', 'teacher_id')
    .addSelect('session.class_id', 'class_id')
    .addSelect('session.id', 'session_id')
    .addSelect('discord_server.discord_server_id', 'discord_server_id')
    .addSelect('discord_server.attendance_voice_channel_id', 'attendance_voice_channel_id')
    .addSelect('discord_server.bot_token', 'bot_token')
    .where('session.status IN (:...sessionStatuses)', {
      sessionStatuses: [SessionStatus.Scheduled, SessionStatus.InProgress],
    })
    .andWhere('class.status = :classStatus', { classStatus: ClassStatus.Active })
    .andWhere('session.scheduled_at >= :dayStart', { dayStart: startOfDay(now) })
    .andWhere('session.scheduled_at <= :dayEnd', { dayEnd: endOfDay(now) })
    .andWhere('discord_server.bot_token IS NOT NULL')
    .andWhere('discord_server.attendance_voice_channel_id IS NOT NULL')
    .setParameters({
      dayOfWeek: now.getDay(),
      timeOfDay: currentTimeString(now),
    })
    .getRawMany<{
      teacher_id: number;
      class_id: number;
      session_id: number;
      discord_server_id: string;
      attendance_voice_channel_id: string;
      bot_token: string;
    }>();

  return rows
    .map((row) => ({
      teacher_id: Number(row.teacher_id),
      class_id: Number(row.class_id),
      session_id: Number(row.session_id),
      discord_server_id: row.discord_server_id,
      attendance_voice_channel_id: row.attendance_voice_channel_id,
      bot_token: row.bot_token,
    }))
    .filter((row) => row.bot_token && row.attendance_voice_channel_id);
}

async function listStudentsByClassSession(
  teacherId: number,
  classId: number,
  sessionId: number,
): Promise<Student[]> {
  const session = await AppDataSource.getRepository(Session).findOneBy({
    id: sessionId,
    teacher_id: teacherId,
    class_id: classId,
  });

  if (!session) {
    return [];
  }

  return AppDataSource.getRepository(Student)
    .createQueryBuilder('student')
    .innerJoin(
      Enrollment,
      'enrollment',
      `
        enrollment.teacher_id = student.teacher_id
        AND enrollment.student_id = student.id
        AND enrollment.class_id = :classId
        AND enrollment.enrolled_at <= :scheduledAt
        AND (enrollment.unenrolled_at IS NULL OR enrollment.unenrolled_at > :scheduledAt)
      `,
      { classId, scheduledAt: session.scheduled_at },
    )
    .where('student.teacher_id = :teacherId', { teacherId })
    .andWhere('student.discord_username IS NOT NULL')
    .getMany();
}

function ensureClient(botToken: string): VoiceAttendanceClientState {
  const existing = clientByToken.get(botToken);
  if (existing) {
    return existing;
  }

  const state: VoiceAttendanceClientState = {
    client: new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
      ],
    }),
    tokenKey: tokenKey(botToken),
    ready: false,
  };

  state.client.once('ready', () => {
    state.ready = true;
    console.log(`[voice-attendance] bot connected (${state.tokenKey})`);
    void syncVoiceAttendanceOnce();
  });

  state.client.on('voiceStateUpdate', (_oldState, newState) => {
    void syncVoiceState(newState);
  });

  state.client.on('error', (error) => {
    console.warn(`[voice-attendance] discord client error (${state.tokenKey})`, error);
  });

  void state.client.login(botToken).catch((error: unknown) => {
    console.warn(`[voice-attendance] failed to login bot (${state.tokenKey})`, error);
    void state.client.destroy();
    clientByToken.delete(botToken);
  });

  clientByToken.set(botToken, state);
  return state;
}

function waitForClientReady(state: VoiceAttendanceClientState, timeoutMs: number): Promise<void> {
  if (state.ready) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new ServiceError('discord bot connection timed out', 504));
    }, timeoutMs);

    const handleReady = () => {
      cleanup();
      resolve();
    };

    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      state.client.off('ready', handleReady);
      state.client.off('error', handleError);
    };

    state.client.once('ready', handleReady);
    state.client.once('error', handleError);
  });
}

async function markPresentStudentsForSession(
  session: OpenVoiceAttendanceSession,
  identities: VoiceMemberIdentity[],
): Promise<number> {
  if (identities.length === 0) {
    return 0;
  }

  const presentKeys = new Set<string>();
  identities.forEach((identity) => {
    identityCandidates(identity).forEach((candidate) => presentKeys.add(candidate));
  });

  const students = await listStudentsByClassSession(session.teacher_id, session.class_id, session.session_id);
  let markedCount = 0;

  for (const student of students) {
    const key = studentDiscordKey(student);
    if (!key || !presentKeys.has(key)) {
      continue;
    }

    const attendance = await AppDataSource.transaction(async (manager) => {
      const attendanceRepository = new TypeOrmAttendanceRepository(manager);
      const finance = new TypeOrmSessionFinanceService(manager);
      const useCase = new UpsertBotSessionAttendanceUseCase(attendanceRepository, finance);

      return useCase.execute({
        teacherId: session.teacher_id,
        sessionId: session.session_id,
        studentId: student.id,
      });
    });
    if (attendance) {
      markedCount += 1;
    }
  }

  return markedCount;
}

async function collectVoiceIdentities(
  client: Client,
  guildId: string,
  channelId: string,
): Promise<VoiceMemberIdentity[]> {
  const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    return [];
  }

  const voiceStates = guild.voiceStates.cache.filter((voiceState) => voiceState.channelId === channelId);
  const identities: VoiceMemberIdentity[] = [];

  for (const voiceState of voiceStates.values()) {
    const cachedIdentity = identityFromVoiceState(voiceState);
    if (cachedIdentity) {
      identities.push(cachedIdentity);
      continue;
    }

    const userId = voiceState.id;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      identities.push({
        user_id: userId,
        username: null,
        global_name: null,
        discriminator: null,
        nick: null,
      });
      continue;
    }

    identities.push({
      user_id: member.user.id,
      username: member.user.username,
      global_name: member.user.globalName,
      discriminator: member.user.discriminator,
      nick: member.nickname ?? null,
    });
  }

  return identities;
}

async function syncOpenSession(session: OpenVoiceAttendanceSession): Promise<number> {
  const state = ensureClient(session.bot_token);
  if (!state.ready) {
    return 0;
  }

  const identities = await collectVoiceIdentities(
    state.client,
    session.discord_server_id,
    session.attendance_voice_channel_id,
  );

  return markPresentStudentsForSession(session, identities);
}

async function getVoiceAttendanceSessionForTeacher(
  teacherId: number,
  sessionId: number,
): Promise<OpenVoiceAttendanceSession> {
  const row = await AppDataSource.getRepository(Session)
    .createQueryBuilder('session')
    .innerJoin(Class, 'class', 'class.id = session.class_id AND class.teacher_id = session.teacher_id')
    .innerJoin(
      DiscordServer,
      'discord_server',
      'discord_server.teacher_id = session.teacher_id AND discord_server.class_id = session.class_id',
    )
    .select('session.teacher_id', 'teacher_id')
    .addSelect('session.class_id', 'class_id')
    .addSelect('session.id', 'session_id')
    .addSelect('session.status', 'session_status')
    .addSelect('discord_server.discord_server_id', 'discord_server_id')
    .addSelect('discord_server.attendance_voice_channel_id', 'attendance_voice_channel_id')
    .addSelect('discord_server.bot_token', 'bot_token')
    .where('session.id = :sessionId', { sessionId })
    .andWhere('session.teacher_id = :teacherId', { teacherId })
    .getRawOne<{
      teacher_id: number;
      class_id: number;
      session_id: number;
      session_status: SessionStatus;
      discord_server_id: string;
      attendance_voice_channel_id: string | null;
      bot_token: string | null;
    }>();

  if (!row) {
    throw new ServiceError('session not found or discord server is not configured for this class', 404);
  }

  if (row.session_status === SessionStatus.Cancelled) {
    throw new ServiceError('cannot sync attendance for a cancelled session', 409);
  }

  if (!row.bot_token) {
    throw new ServiceError('bot_token is missing for this class server', 400);
  }

  if (!row.attendance_voice_channel_id) {
    throw new ServiceError('attendance_voice_channel_id is missing for this class server', 400);
  }

  return {
    teacher_id: Number(row.teacher_id),
    class_id: Number(row.class_id),
    session_id: Number(row.session_id),
    discord_server_id: row.discord_server_id,
    attendance_voice_channel_id: row.attendance_voice_channel_id,
    bot_token: row.bot_token,
  };
}

export async function syncVoiceAttendanceForSession(teacherId: number, sessionId: number): Promise<{
  marked_count: number;
}> {
  if (!AppDataSource.isInitialized) {
    return { marked_count: 0 };
  }

  const session = await getVoiceAttendanceSessionForTeacher(teacherId, sessionId);
  const state = ensureClient(session.bot_token);
  await waitForClientReady(state, 15_000);

  const identities = await collectVoiceIdentities(
    state.client,
    session.discord_server_id,
    session.attendance_voice_channel_id,
  );
  const markedCount = await markPresentStudentsForSession(session, identities);

  if (markedCount > 0) {
    console.log(`[voice-attendance] manual sync marked present: ${markedCount} session=${session.session_id}`);
  }

  return { marked_count: markedCount };
}

async function syncVoiceState(voiceState: VoiceState): Promise<void> {
  if (!voiceState.channelId) {
    return;
  }

  const identity = identityFromVoiceState(voiceState);
  if (!identity) {
    return;
  }

  const sessions = await getOpenVoiceAttendanceSessions(new Date());
  const matchedSessions = sessions.filter((session) => (
    session.discord_server_id === voiceState.guild.id
    && session.attendance_voice_channel_id === voiceState.channelId
  ));

  for (const session of matchedSessions) {
    const markedCount = await markPresentStudentsForSession(session, [identity]);
    if (markedCount > 0) {
      console.log(`[voice-attendance] marked present: ${markedCount} session=${session.session_id}`);
    }
  }
}

export async function syncVoiceAttendanceOnce(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    return;
  }

  const sessions = await getOpenVoiceAttendanceSessions(new Date());
  const activeTokens = new Set(sessions.map((session) => session.bot_token));
  activeTokens.forEach((botToken) => {
    ensureClient(botToken);
  });

  let markedCount = 0;
  for (const session of sessions) {
    markedCount += await syncOpenSession(session);
  }

  if (markedCount > 0) {
    console.log(`[voice-attendance] marked present: ${markedCount}`);
  }
}

function destroyVoiceAttendanceClients(): void {
  clientByToken.forEach((state) => {
    state.client.destroy();
  });
  clientByToken.clear();
}

export function createVoiceAttendanceSyncJob(options: {
  enabled: boolean;
  intervalMs?: number;
}): IntervalJob {
  return {
    name: 'voice-attendance-sync',
    enabled: options.enabled,
    intervalMs: options.intervalMs ?? DEFAULT_SYNC_INTERVAL_MS,
    run: syncVoiceAttendanceOnce,
    onStop: destroyVoiceAttendanceClients,
  };
}
