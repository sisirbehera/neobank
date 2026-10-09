import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiError } from '@neobank/shared/models';
import { HttpError } from '../lib/http-error';

export const apiNotFound: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`No route for ${req.method} ${req.originalUrl}`));
};

// Express recognises error handlers by their four parameters, so `_next` must stay.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    const body: ApiError = {
      error: { code: err.code, message: err.message, fields: err.fields },
    };
    return res.status(err.status).json(body);
  }

  // Malformed JSON body rejected by express.json()
  if (err?.type === 'entity.parse.failed') {
    const body: ApiError = {
      error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' },
    };
    return res.status(400).json(body);
  }

  console.error(err);
  const body: ApiError = {
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  };
  res.status(500).json(body);
};
