import { z } from 'zod';

import {
  booleanSchema,
  commaSeparatedPositiveIntegerArraySchema,
  dateTimeSchema,
} from '../../../../shared/presentation/validation.js';

export const incomeReportQuerySchema = z.object({
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
  class_ids: commaSeparatedPositiveIntegerArraySchema,
  include_unpaid: booleanSchema.optional(),
});
