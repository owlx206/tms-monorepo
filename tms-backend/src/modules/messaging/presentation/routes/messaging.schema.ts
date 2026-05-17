import { z } from 'zod';

import {
  nullableOptionalTrimmedStringSchema,
  optionalPositiveIntegerArraySchema,
  positiveIntegerSchema,
  requiredTrimmedStringSchema,
} from '../../../../shared/schemas/common.schemas.js';

const nonEmptyPositiveIntegerArraySchema = z.array(positiveIntegerSchema)
  .min(1, 'at least one guild is required')
  .transform((values) => Array.from(new Set(values)));

export const classIdParamSchema = z.object({
  classId: positiveIntegerSchema,
});

export const studentIdParamSchema = z.object({
  studentId: positiveIntegerSchema,
});

export const guildIdParamSchema = z.object({
  guildId: positiveIntegerSchema,
});

export const upsertDiscordGuildBodySchema = z.object({
  guild_id: positiveIntegerSchema,
  attendance_voice_channel_id: nullableOptionalTrimmedStringSchema,
  notification_channel_id: nullableOptionalTrimmedStringSchema,
});

export const studentMessageBodySchema = z.object({
  content: requiredTrimmedStringSchema,
  class_id: positiveIntegerSchema.optional(),
  student_ids: optionalPositiveIntegerArraySchema,
}).refine((value) => value.class_id !== undefined || (value.student_ids !== undefined && value.student_ids.length > 0), {
  message: 'at least one recipient is required',
  path: ['student_ids'],
});

export const channelPostBodySchema = z.object({
  content: requiredTrimmedStringSchema,
  guild_ids: nonEmptyPositiveIntegerArraySchema,
});
