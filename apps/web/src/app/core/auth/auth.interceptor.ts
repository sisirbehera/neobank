import {
  HttpErrorResponse,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthStore } from './auth.store';

/** Endpoints that authenticate with the cookie or credentials, not a Bearer token. */
const PUBLIC_AUTH_URL = /^\/api\/auth\/(login|register|refresh|logout)$/;

/**
 * 1. Adds `Authorization: Bearer <token>` to API calls.
 * 2. On a 401 (expired access token) it refreshes once and retries the request.
 * 3. If the refresh fails too, it sends the user to the login page.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/') || PUBLIC_AUTH_URL.test(req.url)) {
    return next(req);
  }

  const store = inject(AuthStore);
  const router = inject(Router);

  const withToken = (request: HttpRequest<unknown>, token: string | null) =>
    token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

  const sentToken = store.accessToken();

  return next(withToken(req, sentToken)).pipe(
    catchError((err: unknown) => {
      const expired =
        err instanceof HttpErrorResponse && err.status === 401 && !!sentToken;
      if (!expired) return throwError(() => err);

      return store.refreshAccessToken().pipe(
        catchError((refreshErr: unknown) => {
          void router.navigate(['/login'], {
            queryParams: { returnUrl: router.url },
          });
          return throwError(() => refreshErr);
        }),
        switchMap((token) => next(withToken(req, token))),
      );
    }),
  );
};
