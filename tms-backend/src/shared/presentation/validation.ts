import { z } from 'zod';

function optionalTrimmedStringToNull(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value as string;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const positiveIntegerSchema = z.coerce.number().int().positive();

export const nonNegativeIntegerSchema = z.coerce.number().int().nonnegative();

export const requiredTrimmedStringSchema = z.string().trim().min(1);

export const optionalTrimmedStringSchema = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().optional()).optional();

export const nullableOptionalTrimmedStringSchema = z.preprocess(
  optionalTrimmedStringToNull,
  z.string().nullable().optional(),
).optional();

export const dateTimeSchema = z.coerce.date();

export const booleanSchema = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
]);

export const positiveIntegerArraySchema = z.array(positiveIntegerSchema)
  .transform((values) => Array.from(new Set(values)));

export const optionalPositiveIntegerArraySchema = positiveIntegerArraySchema.optional();

export const commaSeparatedPositiveIntegerArraySchema = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  return trimmed.split(',');
}, z.array(positiveIntegerSchema).optional())
  .optional()
  .transform((values) => (values === undefined ? undefined : Array.from(new Set(values))));

export const paginationSchema = {
  limit: positiveIntegerSchema.max(200).optional(),
  offset: nonNegativeIntegerSchema.optional(),
};
