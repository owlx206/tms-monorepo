import { z } from 'zod';

import {
  dateTimeSchema,
  optionalTrimmedStringSchema,
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

export const addGymProblemBodySchema = z.object({
  problem_index: requiredTrimmedStringSchema,
  problem_name: optionalTrimmedStringSchema.nullish().transform((value) => value ?? null),
});

export const upsertGymStandingBodySchema = z.object({
  student_id: positiveIntegerSchema,
  problem_id: positiveIntegerSchema,
  solved: z.boolean().optional().default(false),
  penalty_minutes: positiveIntegerSchema.nullish().transform((value) => value ?? null),
  pulled_at: dateTimeSchema.optional(),
});
