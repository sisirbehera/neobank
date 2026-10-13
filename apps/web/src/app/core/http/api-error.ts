import { HttpErrorResponse } from '@angular/common/http';
import { type ApiError, ApiErrorSchema } from '@neobank/shared/models';
import { translateValidationMessage } from '@neobank/web/ui/messages';
import { apiErrorText } from '../i18n/messages';

/**
 * Extracts the API's `{ error: {...} }` body, with a fallback for network
 * errors. `message` is in the page's language: chosen by the error's code,
 * or, for codes the app doesn't know, the API's own (English) message.
 */
export function toApiError(err: unknown): ApiError['error'] {
  const error = parse(err);
  const fields = error.fields
    ? Object.fromEntries(
        Object.entries(error.fields).map(([name, messages]) => [
          name,
          messages.map(translateValidationMessage),
        ]),
      )
    : undefined;
  return {
    ...error,
    message: apiErrorText(error.code, error.meta) ?? error.message,
    ...(fields && { fields }),
  };
}

function parse(err: unknown): ApiError['error'] {
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
