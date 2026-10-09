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
      /** Errors propagate to the caller (the form shows them). */
      async login(credentials: LoginRequest): Promise<void> {
        setSession(await firstValueFrom(api.login(credentials)));
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
