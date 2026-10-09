import { HttpErrorResponse } from '@angular/common/http';
import { type ApiError, ApiErrorSchema } from '@neobank/shared/models';

/** Extracts the API's `{ error: {...} }` body, with a fallback for network errors. */
export function toApiError(err: unknown): ApiError['error'] {
  if (err instanceof HttpErrorResponse) {
    const parsed = ApiErrorSchema.safeParse(err.error);
    if (parsed.success) return parsed.data.error;
    if (err.status === 0) {
      return {
        code: 'NETWORK_ERROR',
        message:
          'Cannot reach the server. Check your connection and try again.',
      };
    }
  }
  return {
    code: 'UNKNOWN',
    message: 'Something went wrong. Please try again.',
  };
}
