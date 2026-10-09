import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import type {
  AuthResponse,
  LoginRequest,
  MfaChallenge,
  MfaSetupResponse,
  RegisterRequest,
  UserDto,
} from '@neobank/shared/models';
import {
  catchError,
  finalize,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { AuthApi } from './auth.api';

/** 'unknown' only while the app is restoring the session on startup. */
export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  user: UserDto | null;
  /** Kept in memory only (never localStorage), so XSS can't read it from storage. */
  accessToken: string | null;
  status: AuthStatus;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  status: 'unknown',
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ user, status }) => ({
    isAuthenticated: computed(() => status() === 'authenticated'),
    isAdmin: computed(() => user()?.role === 'admin'),
  })),
  withMethods((store, api = inject(AuthApi)) => {
    const setSession = ({ user, accessToken }: AuthResponse) =>
      patchState(store, { user, accessToken, status: 'authenticated' });

    const clearSession = () =>
      patchState(store, { user: null, accessToken: null, status: 'anonymous' });

    // Shared so that parallel 401s trigger a single /refresh call.
    let refreshInFlight$: Observable<string> | null = null;

    return {
      /**
       * Step 1. Resolves to null when signed in, or to a challenge when a
       * second step (code / 2FA setup) is needed. Errors propagate to the form.
       */
      async login(credentials: LoginRequest): Promise<MfaChallenge | null> {
        const result = await firstValueFrom(api.login(credentials));
        if ('mfaRequired' in result) return result;
        setSession(result);
        return null;
      },

      /** Step 2: a code from the authenticator app (or a backup code). */
      async verifyMfa(mfaToken: string, code: string): Promise<void> {
        setSession(await firstValueFrom(api.verifyMfa(mfaToken, code)));
      },

      /** Admin's first sign-in: get the QR code to scan. */
      enrollStart(mfaToken: string): Promise<MfaSetupResponse> {
        return firstValueFrom(api.enrollStart(mfaToken));
      },

      /** Finish setup: starts the session and returns the backup codes. */
      async enrollConfirm(mfaToken: string, code: string): Promise<string[]> {
        const { backupCodes, ...session } = await firstValueFrom(
          api.enrollConfirm(mfaToken, code),
        );
        setSession(session);
        return backupCodes;
      },

      /** Keeps the user's 2FA flag in sync after the Security page changes it. */
      setMfaEnabled(mfaEnabled: boolean): void {
        const user = store.user();
        if (user) patchState(store, { user: { ...user, mfaEnabled } });
      },

      async register(details: RegisterRequest): Promise<void> {
        setSession(await firstValueFrom(api.register(details)));
      },

      async logout(): Promise<void> {
        try {
          await firstValueFrom(api.logout());
        } catch {
          // Even if the server call fails, forget the session locally.
        } finally {
          clearSession();
        }
      },

      /** Runs once at startup: the refresh cookie (if any) brings the session back. */
      async restoreSession(): Promise<void> {
        try {
          setSession(await firstValueFrom(api.refresh()));
        } catch {
          clearSession();
        }
      },

      /** Used by the interceptor when an access token expires. */
      refreshAccessToken(): Observable<string> {
        refreshInFlight$ ??= api.refresh().pipe(
          tap(setSession),
          map((session) => session.accessToken),
          catchError((err) => {
            clearSession();
            return throwError(() => err);
          }),
          finalize(() => (refreshInFlight$ = null)),
          shareReplay(1),
        );
        return refreshInFlight$;
      },

      clearSession,
    };
  }),
);
