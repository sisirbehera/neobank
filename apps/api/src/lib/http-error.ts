/** Throw (or pass to next()) from any route or service to send a specific HTTP error. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
  }

  static badRequest(message: string, fields?: Record<string, string[]>) {
    return new HttpError(400, 'BAD_REQUEST', message, fields);
  }

  static unauthorized(
    message = 'Authentication required',
    code = 'UNAUTHORIZED',
  ) {
    return new HttpError(401, code, message);
  }

  static forbidden(message = 'You do not have access to this resource') {
    return new HttpError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found') {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static conflict(
    message: string,
    code = 'CONFLICT',
    fields?: Record<string, string[]>,
  ) {
    return new HttpError(409, code, message, fields);
  }
}
