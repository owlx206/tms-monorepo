import { z } from 'zod';

import { FeeRecordStatus, TransactionType } from '../../contracts/types.js';
import { StudentStatus } from '../../../student/contracts/types.js';
import {
  booleanSchema,
  commaSeparatedPositiveIntegerArraySchema,
  dateTimeSchema,
  optionalTrimmedStringSchema,
  paginationSchema,
  positiveIntegerSchema,
  requiredTrimmedStringSchema,
} from '../../../../shared/presentation/validation.js';

export const financeTransactionListQuerySchema = z.object({
  student_id: positiveIntegerSchema.optional(),
  type: z.nativeEnum(TransactionType).optional(),
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
  ...paginationSchema,
});

export const financeTransactionBodySchema = z.object({
  student_id: positiveIntegerSchema,
  amount: requiredTrimmedStringSchema,
  type: z.nativeEnum(TransactionType),
  notes: optionalTrimmedStringSchema.nullish().transform((value) => value ?? null),
  recorded_at: dateTimeSchema.optional(),
});

export const updateFinanceTransactionBodySchema = financeTransactionBodySchema.extend({
  update_reason: optionalTrimmedStringSchema.nullish().transform((value) => value ?? null),
});

export const financeIdParamSchema = z.object({
  id: positiveIntegerSchema,
});

export const financeFeeRecordListQuerySchema = z.object({
  student_id: positiveIntegerSchema.optional(),
  session_id: positiveIntegerSchema.optional(),
  status: z.nativeEnum(FeeRecordStatus).optional(),
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
  ...paginationSchema,
});

export const updateFeeRecordStatusBodySchema = z.object({
  status: z.nativeEnum(FeeRecordStatus),
});

export const studentBalancesQuerySchema = z.object({
  status: z.nativeEnum(StudentStatus).optional(),
  include_pending_archive: booleanSchema.optional(),
});

export const financeSummaryQuerySchema = z.object({
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
  class_ids: commaSeparatedPositiveIntegerArraySchema,
  include_unpaid: booleanSchema.optional(),
});
