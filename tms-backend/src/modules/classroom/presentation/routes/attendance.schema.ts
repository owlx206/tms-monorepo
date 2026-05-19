import { z } from 'zod';

import { AttendanceStatus } from '../../contracts/types.js';
import { positiveIntegerSchema } from '../../../../shared/presentation/validation.js';

export const sessionIdParamSchema = z.object({
  sessionId: positiveIntegerSchema,
});

export const sessionStudentIdParamSchema = z.object({
  sessionId: positiveIntegerSchema,
  studentId: positiveIntegerSchema,
});

export const upsertAttendanceBodySchema = z.object({
  status: z.nativeEnum(AttendanceStatus),
  notes: z.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, z.string().nullable().optional()).optional(),
});

export const attendanceListQuerySchema = z.object({
  session_id: positiveIntegerSchema.optional(),
  student_id: positiveIntegerSchema.optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
});

export type SessionIdParam = z.infer<typeof sessionIdParamSchema>;
export type SessionStudentIdParam = z.infer<typeof sessionStudentIdParamSchema>;
export type UpsertAttendanceBody = z.infer<typeof upsertAttendanceBodySchema>;
export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>;
