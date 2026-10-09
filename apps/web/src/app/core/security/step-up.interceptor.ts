import {
  HttpErrorResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {
  ApiErrorSchema,
  STEP_UP_HEADER,
  StepUpActionSchema,
} from '@neobank/shared/models';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { StepUpDialog } from './step-up-dialog';

/**
 * Risky actions answer `403 STEP_UP_REQUIRED` (meta.action says which).
 * This interceptor asks for a 2FA code in a dialog, exchanges it for a
 * step-up token and retries the SAME request with that token, so pages
 * (transfers, beneficiaries, …) need no step-up code of their own.
 * Retries keep their Idempotency-Key, so money still moves at most once.
 */
export const stepUpInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url === '/api/security/step-up') return next(req);
  const modal = inject(NgbModal);

  return next(req).pipe(
    catchError((err: unknown) => {
      const action = stepUpAction(err);
      if (!action) return throwError(() => err);

      const ref = modal.open(StepUpDialog, { centered: true });
      (ref.componentInstance as StepUpDialog).setup(action);

      return from(ref.result as Promise<string>).pipe(
        catchError(() =>
          // Dialog dismissed: fail with a clear, non-scary message.
          throwError(
            () =>
              new HttpErrorResponse({
                status: 403,
                url: req.url,
                error: {
                  error: {
                    code: 'STEP_UP_CANCELLED',
                    message: 'Verification was cancelled. Nothing was changed.',
                  },
                },
              }),
          ),
        ),
        switchMap((token) =>
          next(req.clone({ setHeaders: { [STEP_UP_HEADER]: token } })),
        ),
      );
    }),
  );
};

function stepUpAction(err: unknown) {
  if (!(err instanceof HttpErrorResponse) || err.status !== 403) return null;
  const body = ApiErrorSchema.safeParse(err.error);
  if (!body.success || body.data.error.code !== 'STEP_UP_REQUIRED') return null;
  const action = StepUpActionSchema.safeParse(body.data.error.meta?.['action']);
  return action.success ? action.data : null;
}
