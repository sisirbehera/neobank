import type { Request } from 'express';
import { HttpError } from './http-error';

/** The signed-in user's id (requireAuth guarantees it is set). */
export function userId(req: Request): string {
  if (!req.auth) throw HttpError.unauthorized();
  return req.auth.userId;
}

/** A route parameter as a string (Express types them loosely once middleware is added). */
export function param(req: Request, name: string): string {
  return String(req.params[name]);
}
