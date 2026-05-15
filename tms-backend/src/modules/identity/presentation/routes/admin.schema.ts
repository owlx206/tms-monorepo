import { z } from 'zod';

import { TeacherRole } from '../../../../entities/enums.js';
import {
  booleanSchema,
  nullableOptionalTrimmedStringSchema,
  positiveIntegerSchema,
  requiredTrimmedStringSchema,
} from '../../../../shared/schemas/common.schemas.js';

export const teacherIdParamSchema = z.object({
  teacherId: positiveIntegerSchema,
});

export const updateTeacherByAdminBodySchema = z.object({
  username: requiredTrimmedStringSchema.optional(),
  password: requiredTrimmedStringSchema.optional(),
  role: z.nativeEnum(TeacherRole).optional(),
  is_active: booleanSchema.optional(),
  codeforces_handle: nullableOptionalTrimmedStringSchema.optional(),
  codeforces_api_key: nullableOptionalTrimmedStringSchema.optional(),
  codeforces_api_secret: nullableOptionalTrimmedStringSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'at least one field is required',
});

export const upsertSysadminDiscordBotCredentialBodySchema = z.object({
  bot_token: requiredTrimmedStringSchema,
  client_id: requiredTrimmedStringSchema,
  client_secret: requiredTrimmedStringSchema,
  permissions: nullableOptionalTrimmedStringSchema,
  scopes: nullableOptionalTrimmedStringSchema,
});
