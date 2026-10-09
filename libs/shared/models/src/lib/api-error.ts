import { z } from 'zod';

/** Shape of every error response returned by the API. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    /** Field-level validation messages, keyed by field path. */
    fields: z.record(z.string(), z.array(z.string())).optional(),
    /** Extra machine-readable details, e.g. { action } for STEP_UP_REQUIRED. */
    meta: z.record(z.string(), z.string()).optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
