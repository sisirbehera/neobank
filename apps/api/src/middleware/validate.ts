import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError } from '../lib/http-error';

function validationError(error: z.ZodError): HttpError {
  const { fieldErrors } = z.flattenError(error);
  return HttpError.badRequest(
    'Validation failed',
    fieldErrors as Record<string, string[]>,
  );
}

/**
 * Validates `req.body` against a Zod schema from @neobank/shared/models
 * and replaces it with the parsed (typed, trimmed, defaulted) value.
 */
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(validationError(result.error));
    req.body = result.data;
    next();
  };
}

/**
 * Parses the query string with a Zod schema. (Express 5 makes `req.query`
 * read-only, so the parsed value is returned instead of stored.)
 */
export function parseQuery<T extends z.ZodType>(
  schema: T,
  req: Request,
): z.output<T> {
  const result = schema.safeParse(req.query);
  if (!result.success) throw validationError(result.error);
  return result.data;
}
