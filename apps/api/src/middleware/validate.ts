import type { RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError } from '../lib/http-error';

/**
 * Validates `req.body` against a Zod schema from @neobank/shared/models
 * and replaces it with the parsed (typed, trimmed, defaulted) value.
 */
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const { fieldErrors } = z.flattenError(result.error);
      return next(
        HttpError.badRequest(
          'Validation failed',
          fieldErrors as Record<string, string[]>,
        ),
      );
    }
    req.body = result.data;
    next();
  };
}
