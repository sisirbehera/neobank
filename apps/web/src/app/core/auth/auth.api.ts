import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  type AuthResponse,
  AuthResponseSchema,
  type EnrollConfirmResponse,
  EnrollConfirmResponseSchema,
  type LoginRequest,
  type LoginResponse,
  LoginResponseSchema,
  type MfaSetupResponse,
  MfaSetupResponseSchema,
  type RegisterRequest,
} from '@neobank/shared/models';
import { map, Observable } from 'rxjs';

/** Thin HTTP client for /api/auth. The refresh token rides in an httpOnly cookie. */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);

  register(body: RegisterRequest): Observable<AuthResponse> {
    return this.session(this.http.post('/api/auth/register', body));
  }

  /** A session, or a 2FA challenge when a second step is needed. */
  login(body: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<unknown>('/api/auth/login', body)
      .pipe(map((res) => LoginResponseSchema.parse(res)));
  }

  verifyMfa(mfaToken: string, code: string): Observable<AuthResponse> {
    return this.session(
      this.http.post('/api/auth/mfa/verify', { mfaToken, code }),
    );
  }

  enrollStart(mfaToken: string): Observable<MfaSetupResponse> {
    return this.http
      .post<unknown>('/api/auth/mfa/enroll/start', { mfaToken })
      .pipe(map((res) => MfaSetupResponseSchema.parse(res)));
  }

  enrollConfirm(
    mfaToken: string,
    code: string,
  ): Observable<EnrollConfirmResponse> {
    return this.http
      .post<unknown>('/api/auth/mfa/enroll/confirm', { mfaToken, code })
      .pipe(map((res) => EnrollConfirmResponseSchema.parse(res)));
  }

  refresh(): Observable<AuthResponse> {
    return this.session(this.http.post('/api/auth/refresh', null));
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', null);
  }

  private session(request: Observable<unknown>): Observable<AuthResponse> {
    return request.pipe(map((body) => AuthResponseSchema.parse(body)));
  }
}
