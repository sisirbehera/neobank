import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import type { $ZodType, output } from 'zod/v4/core';
import { HttpError } from '../lib/http-error';

// The shared request schemas are written with `zod/mini` (small in the
// browser); the API uses full `zod`. Both build on Zod's core, so these
// helpers accept any core schema ($ZodType) and validate with z.safeParse.

function validationError(error: z.core.$ZodError): HttpError {
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
export function validateBody(schema: $ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = z.safeParse(schema, req.body);
    if (!result.success) return next(validationError(result.error));
    req.body = result.data;
    next();
  };
}

/**
 * Parses the query string with a Zod schema. (Express 5 makes `req.query`
 * read-only, so the parsed value is returned instead of stored.)
 */
export function parseQuery<T extends $ZodType>(
  schema: T,
  req: Request,
): output<T> {
  const result = z.safeParse(schema, req.query);
  if (!result.success) throw validationError(result.error);
  return result.data as output<T>;
}
