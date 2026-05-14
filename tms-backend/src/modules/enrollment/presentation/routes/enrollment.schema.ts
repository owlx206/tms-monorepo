import { z } from 'zod';

import {
  EnrollmentPendingArchiveReason,
  EnrollmentStudentStatus,
} from '../../domain/models/Student.js';
import {
  booleanSchema,
  dateTimeSchema,
  optionalTrimmedStringSchema,
  positiveIntegerArraySchema,
  positiveIntegerSchema,
  requiredTrimmedStringSchema,
} from '../../../../shared/schemas/common.schemas.js';

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

const nonEmptyStudentIdsSchema = positiveIntegerArraySchema.refine((value) => value.length > 0, {
  message: 'student_ids must include at least one student',
});

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

export const bulkTransferStudentsBodySchema = z.object({
  student_ids: nonEmptyStudentIdsSchema,
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
    student_ids: value.student_ids,
    to_class_id: toClassId,
    transferred_at: value.transferred_at,
  };
});

export const bulkWithdrawStudentsBodySchema = z.object({
  student_ids: nonEmptyStudentIdsSchema,
  withdrawn_at: dateTimeSchema.optional().default(() => new Date()),
});

export const archivePendingStudentBodySchema = z.object({
  archived_at: dateTimeSchema.optional().default(() => new Date()),
  settle_finance: booleanSchema.optional().default(false),
});

export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
export type StudentListQuery = z.infer<typeof studentListQuerySchema>;
export type CreateStudentBody = z.infer<typeof createStudentBodySchema>;
export type UpdateStudentBody = z.infer<typeof updateStudentBodySchema>;
export type ReinstateStudentBody = z.infer<typeof reinstateStudentBodySchema>;
export type TransferStudentBody = z.infer<typeof transferStudentBodySchema>;
export type WithdrawStudentBody = z.infer<typeof withdrawStudentBodySchema>;
export type BulkTransferStudentsBody = z.infer<typeof bulkTransferStudentsBodySchema>;
export type BulkWithdrawStudentsBody = z.infer<typeof bulkWithdrawStudentsBodySchema>;
export type ArchivePendingStudentBody = z.infer<typeof archivePendingStudentBodySchema>;
