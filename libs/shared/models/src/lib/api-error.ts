import * as z from 'zod/mini';

/** Shape of every error response returned by the API. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    /** Field-level validation messages, keyed by field path. */
    fields: z.optional(z.record(z.string(), z.array(z.string()))),
    /** Extra machine-readable details, e.g. { action } for STEP_UP_REQUIRED. */
    meta: z.optional(z.record(z.string(), z.string())),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
