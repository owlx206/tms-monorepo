import { z } from 'zod';

import {
  nullableOptionalTrimmedStringSchema,
  positiveIntegerSchema,
  requiredTrimmedStringSchema,
} from '../../../../shared/schemas/common.schemas.js';

export const studentIdParamSchema = z.object({
  studentId: positiveIntegerSchema,
});

export const loginBodySchema = z.object({
  username: requiredTrimmedStringSchema,
  password: z.string().min(1),
});

export const registerBodySchema = loginBodySchema.extend({
  codeforces_handle: nullableOptionalTrimmedStringSchema,
  codeforces_api_key: nullableOptionalTrimmedStringSchema,
  codeforces_api_secret: nullableOptionalTrimmedStringSchema,
});

export const updateMeBodySchema = z.object({
  username: requiredTrimmedStringSchema.optional(),
  password: z.string().min(1).optional(),
  codeforces_handle: nullableOptionalTrimmedStringSchema.optional(),
  codeforces_api_key: nullableOptionalTrimmedStringSchema.optional(),
  codeforces_api_secret: nullableOptionalTrimmedStringSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'at least one field is required',
});
