import { z } from 'zod';

import {
  EnrollmentPendingArchiveReason,
  EnrollmentStudentStatus,
} from '../../contracts/types.js';
import {
  dateTimeSchema,
  optionalTrimmedStringSchema,
  optionalPositiveIntegerArraySchema,
  positiveIntegerSchema,
  requiredTrimmedStringSchema,
} from '../../../../shared/presentation/validation.js';

const nullableTrimmedStringSchema = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}, z.string().nullable());

const optionalNullableTrimmedStringSchema = nullableTrimmedStringSchema
  .optional()
  .transform((value) => value ?? null);

export const studentIdParamSchema = z.object({
  studentId: positiveIntegerSchema,
});

export const studentListQuerySchema = z.object({
  status: z.nativeEnum(EnrollmentStudentStatus).optional(),
  pending_archive_reason: z.nativeEnum(EnrollmentPendingArchiveReason).optional(),
  class_id: positiveIntegerSchema.optional(),
  search: optionalTrimmedStringSchema,
});

export const createStudentBodySchema = z.object({
  full_name: requiredTrimmedStringSchema,
  class_id: positiveIntegerSchema,
  codeforces_handle: requiredTrimmedStringSchema,
  phone: optionalNullableTrimmedStringSchema,
  note: nullableTrimmedStringSchema,
  enrolled_at: dateTimeSchema.optional().default(() => new Date()),
});

export const updateStudentBodySchema = z.object({
  full_name: requiredTrimmedStringSchema.optional(),
  codeforces_handle: requiredTrimmedStringSchema.optional(),
  phone: nullableTrimmedStringSchema.optional(),
  note: nullableTrimmedStringSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'at least one field is required',
});

export const reinstateStudentBodySchema = z.object({
  class_id: positiveIntegerSchema,
  enrolled_at: dateTimeSchema.optional().default(() => new Date()),
});

export const transferStudentBodySchema = z.object({
  to_class_id: positiveIntegerSchema.optional(),
  class_id: positiveIntegerSchema.optional(),
  transferred_at: dateTimeSchema.optional().default(() => new Date()),
}).transform((value, ctx) => {
  const toClassId = value.to_class_id ?? value.class_id;
  if (toClassId === undefined) {
    ctx.addIssue({ code: 'custom', message: 'to_class_id is required', path: ['to_class_id'] });
    return z.NEVER;
  }

  return {
    to_class_id: toClassId,
    transferred_at: value.transferred_at,
  };
});

export const withdrawStudentBodySchema = z.object({
  withdrawn_at: dateTimeSchema.optional().default(() => new Date()),
});

export const archivePendingStudentBodySchema = z.preprocess(
  (value) => (value === undefined ? {} : value),
  z.object({
    archived_at: dateTimeSchema.optional().default(() => new Date()),
  }),
);

export const singleStudentMessageBodySchema = z.object({
  content: requiredTrimmedStringSchema,
});

export const studentMessageBodySchema = z.object({
  content: requiredTrimmedStringSchema,
  class_id: positiveIntegerSchema.optional(),
  student_ids: optionalPositiveIntegerArraySchema,
}).refine((value) => value.class_id !== undefined || (value.student_ids !== undefined && value.student_ids.length > 0), {
  message: 'at least one recipient is required',
  path: ['student_ids'],
});

export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
export type StudentListQuery = z.infer<typeof studentListQuerySchema>;
export type CreateStudentBody = z.infer<typeof createStudentBodySchema>;
export type UpdateStudentBody = z.infer<typeof updateStudentBodySchema>;
export type ReinstateStudentBody = z.infer<typeof reinstateStudentBodySchema>;
export type TransferStudentBody = z.infer<typeof transferStudentBodySchema>;
export type WithdrawStudentBody = z.infer<typeof withdrawStudentBodySchema>;
export type ArchivePendingStudentBody = z.infer<typeof archivePendingStudentBodySchema>;
export type SingleStudentMessageBody = z.infer<typeof singleStudentMessageBodySchema>;
export type StudentMessageBody = z.infer<typeof studentMessageBodySchema>;
