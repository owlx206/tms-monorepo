import { z } from 'zod';

import { positiveIntegerSchema } from '../../../../shared/presentation/validation.js';

export const studentIdParamSchema = z.object({
  studentId: positiveIntegerSchema,
});

export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
