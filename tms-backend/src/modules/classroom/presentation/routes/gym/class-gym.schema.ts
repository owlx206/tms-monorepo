import { z } from 'zod';

import {
  positiveIntegerSchema,
  requiredTrimmedStringSchema,
} from '../../../../../shared/presentation/validation.js';

export const gymIdParamSchema = z.object({
  gymId: positiveIntegerSchema,
});

export const classGymParamSchema = z.object({
  classId: positiveIntegerSchema,
  gymId: positiveIntegerSchema,
});

export const classIdParamSchema = z.object({
  classId: positiveIntegerSchema,
});

export const gymListQuerySchema = z.object({
  status: z.literal('active').optional(),
});

export const bindClassGymBodySchema = z.object({
  gym_id: requiredTrimmedStringSchema.regex(/^\d+$/, 'gym_id must be numeric'),
  pull_interval_minutes: positiveIntegerSchema.optional(),
});
