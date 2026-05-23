import { z } from 'zod';

import { ClassStatus, SessionStatus } from '../../contracts/types.js';
import {
  booleanSchema,
  dateTimeSchema,
  nullableOptionalTrimmedStringSchema,
  positiveIntegerSchema,
  requiredTrimmedStringSchema,
} from '../../../../shared/presentation/validation.js';

const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

function normalizeDateOnly(value: string): string {
  const match = dateOnlyPattern.exec(value.trim());
  if (!match) {
    throw new Error('must be in YYYY-MM-DD format');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    throw new Error('is not a valid date');
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeTime(value: string): string {
  const match = timePattern.exec(value.trim());
  if (!match) {
    throw new Error('must be in HH:mm or HH:mm:ss format');
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;

  if (hours > 23 || minutes > 59 || seconds > 59) {
    throw new Error('has invalid time value');
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function combineDateAndTime(dateOnly: string, timeValue: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const [hours, minutes, seconds] = timeValue.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds, 0);
}

const feePerSessionSchema = z.coerce.number().int().nonnegative().transform(String);
const normalizedTimeSchema = z.string().trim().transform((value, ctx) => {
  try {
    return normalizeTime(value);
  } catch (error) {
    ctx.addIssue({
      code: 'custom',
      message: error instanceof Error ? error.message : 'invalid time',
    });
    return z.NEVER;
  }
});

export const classIdParamSchema = z.object({
  classId: positiveIntegerSchema,
});

export const sessionIdParamSchema = z.object({
  sessionId: positiveIntegerSchema,
});

export const guildIdParamSchema = z.object({
  guildId: positiveIntegerSchema,
});

export const classListQuerySchema = z.object({
  status: z.nativeEnum(ClassStatus).optional(),
  ready_only: booleanSchema.optional(),
});

export const classScheduleBodySchema = z.object({
  day_of_week: z.coerce.number().int().min(0).max(6),
  start_time: normalizedTimeSchema,
  end_time: normalizedTimeSchema,
}).refine((value) => value.end_time > value.start_time, {
  message: 'end_time must be later than start_time',
  path: ['end_time'],
});

export const createClassBodySchema = z.object({
  name: requiredTrimmedStringSchema,
  fee_per_session: feePerSessionSchema,
  schedules: z.array(classScheduleBodySchema).min(1, 'class must have at least one schedule'),
});

export const updateClassBodySchema = z.object({
  name: requiredTrimmedStringSchema.optional(),
  fee_per_session: feePerSessionSchema.optional(),
  schedules: z.array(classScheduleBodySchema).min(1, 'class must have at least one schedule').optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'at least one field is required',
});

export const upsertDiscordGuildBodySchema = z.object({
  guild_id: positiveIntegerSchema,
  attendance_voice_channel_id: nullableOptionalTrimmedStringSchema,
  notification_channel_id: nullableOptionalTrimmedStringSchema,
});

export const channelPostBodySchema = z.object({
  content: requiredTrimmedStringSchema,
  guild_ids: z.array(positiveIntegerSchema)
    .min(1, 'at least one guild is required')
    .transform((values) => Array.from(new Set(values))),
});

export const sessionListQuerySchema = z.object({
  class_id: positiveIntegerSchema.optional(),
  status: z.nativeEnum(SessionStatus).optional(),
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: 'from must be earlier than or equal to to',
  path: ['to'],
});

export const createManualSessionBodySchema = z.object({
  scheduled_at: dateTimeSchema.optional(),
  scheduled_date: z.string().trim().optional(),
  start_time: normalizedTimeSchema.optional(),
  end_time: normalizedTimeSchema,
}).transform((value, ctx) => {
  if (value.scheduled_at !== undefined) {
    const startTime = [
      String(value.scheduled_at.getHours()).padStart(2, '0'),
      String(value.scheduled_at.getMinutes()).padStart(2, '0'),
      String(value.scheduled_at.getSeconds()).padStart(2, '0'),
    ].join(':');

    if (value.end_time <= startTime) {
      ctx.addIssue({
        code: 'custom',
        message: 'end_time must be later than start_time',
        path: ['end_time'],
      });
      return z.NEVER;
    }

    return {
      scheduled_at: value.scheduled_at,
      end_time: value.end_time,
    };
  }

  if (value.scheduled_date === undefined || value.start_time === undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'either scheduled_at + end_time or scheduled_date + start_time + end_time is required',
    });
    return z.NEVER;
  }

  let dateOnly: string;
  try {
    dateOnly = normalizeDateOnly(value.scheduled_date);
  } catch (error) {
    ctx.addIssue({
      code: 'custom',
      message: error instanceof Error ? `scheduled_date ${error.message}` : 'scheduled_date is invalid',
      path: ['scheduled_date'],
    });
    return z.NEVER;
  }

  if (value.end_time <= value.start_time) {
    ctx.addIssue({
      code: 'custom',
      message: 'end_time must be later than start_time',
      path: ['end_time'],
    });
    return z.NEVER;
  }

  return {
    scheduled_at: combineDateAndTime(dateOnly, value.start_time),
    end_time: value.end_time,
  };
});

export type ClassIdParam = z.infer<typeof classIdParamSchema>;
export type SessionIdParam = z.infer<typeof sessionIdParamSchema>;
export type ClassListQuery = z.infer<typeof classListQuerySchema>;
export type CreateClassBody = z.infer<typeof createClassBodySchema>;
export type UpdateClassBody = z.infer<typeof updateClassBodySchema>;
export type CreateClassScheduleBody = z.infer<typeof classScheduleBodySchema>;
export type SessionListQuery = z.infer<typeof sessionListQuerySchema>;
export type CreateManualSessionBody = z.infer<typeof createManualSessionBodySchema>;
