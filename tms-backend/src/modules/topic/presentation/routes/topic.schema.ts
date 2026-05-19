import { z } from 'zod';

import {
  dateTimeSchema,
  optionalTrimmedStringSchema,
  positiveIntegerSchema,
  requiredTrimmedStringSchema,
} from '../../../../shared/presentation/validation.js';

const codeforcesGymLinkSchema = requiredTrimmedStringSchema.transform((value, ctx) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    ctx.addIssue({
      code: 'custom',
      message: 'gym_link must be a valid URL',
    });
    return z.NEVER;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    ctx.addIssue({
      code: 'custom',
      message: 'gym_link must start with http:// or https://',
    });
    return z.NEVER;
  }

  return parsed.toString();
});

export const topicIdParamSchema = z.object({
  topicId: positiveIntegerSchema,
});

export const topicListQuerySchema = z.object({
  class_id: positiveIntegerSchema.optional(),
  status: z.enum(['active', 'closed']).optional(),
});

export const createTopicBodySchema = z.object({
  class_id: positiveIntegerSchema,
  gym_link: codeforcesGymLinkSchema,
  pull_interval_minutes: positiveIntegerSchema.optional(),
});

export const addTopicProblemBodySchema = z.object({
  problem_index: requiredTrimmedStringSchema,
  problem_name: optionalTrimmedStringSchema.nullish().transform((value) => value ?? null),
});

export const upsertTopicStandingBodySchema = z.object({
  student_id: positiveIntegerSchema,
  problem_id: positiveIntegerSchema,
  solved: z.boolean().optional().default(false),
  penalty_minutes: positiveIntegerSchema.nullish().transform((value) => value ?? null),
  pulled_at: dateTimeSchema.optional(),
});
