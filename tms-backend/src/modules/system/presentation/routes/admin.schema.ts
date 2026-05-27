import { z } from 'zod';

import {
  booleanSchema,
  nullableOptionalTrimmedStringSchema,
  positiveIntegerSchema,
  requiredTrimmedStringSchema,
} from '../../../../shared/presentation/validation.js';

export const teacherIdParamSchema = z.object({
  teacherId: positiveIntegerSchema,
});

export const updateTeacherAccountBodySchema = z.object({
  username: requiredTrimmedStringSchema.optional(),
  password: requiredTrimmedStringSchema.optional(),
  is_active: booleanSchema.optional(),
  codeforces_handle: nullableOptionalTrimmedStringSchema.optional(),
  codeforces_api_key: nullableOptionalTrimmedStringSchema.optional(),
  codeforces_api_secret: nullableOptionalTrimmedStringSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'at least one field is required',
});

export const upsertDiscordBotCredentialBodySchema = z.object({
  bot_token: requiredTrimmedStringSchema,
  client_id: requiredTrimmedStringSchema,
  client_secret: requiredTrimmedStringSchema,
  permissions: nullableOptionalTrimmedStringSchema,
  scopes: nullableOptionalTrimmedStringSchema,
});
