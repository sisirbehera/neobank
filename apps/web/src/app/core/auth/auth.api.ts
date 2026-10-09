import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  type AuthResponse,
  AuthResponseSchema,
  type LoginRequest,
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

  login(body: LoginRequest): Observable<AuthResponse> {
    return this.session(this.http.post('/api/auth/login', body));
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
