import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  BackupCodesResponseSchema,
  type ChangePasswordRequest,
  type MfaDisableRequest,
  type MfaSetupResponse,
  MfaSetupResponseSchema,
  type SessionDto,
  SessionDtoSchema,
  type StepUpAction,
  StepUpResponseSchema,
} from '@neobank/shared/models';
import { map, Observable } from 'rxjs';

/** /api/security: two-step verification, step-up codes, password, sessions. */
@Injectable({ providedIn: 'root' })
export class SecurityApi {
  private readonly http = inject(HttpClient);

  mfaSetup(): Observable<MfaSetupResponse> {
    return this.http
      .post<unknown>('/api/security/mfa/setup', null)
      .pipe(map((b) => MfaSetupResponseSchema.parse(b)));
  }

  mfaEnable(code: string): Observable<string[]> {
    return this.http
      .post<unknown>('/api/security/mfa/enable', { code })
      .pipe(map((b) => BackupCodesResponseSchema.parse(b).backupCodes));
  }

  mfaDisable(body: MfaDisableRequest): Observable<void> {
    return this.http.post<void>('/api/security/mfa/disable', body);
  }

  regenerateBackupCodes(code: string): Observable<string[]> {
    return this.http
      .post<unknown>('/api/security/mfa/backup-codes', { code })
      .pipe(map((b) => BackupCodesResponseSchema.parse(b).backupCodes));
  }

  /** A fresh code → a short-lived token allowing one kind of risky action. */
  stepUp(action: StepUpAction, code: string): Observable<string> {
    return this.http
      .post<unknown>('/api/security/step-up', { action, code })
      .pipe(map((b) => StepUpResponseSchema.parse(b).stepUpToken));
  }

  changePassword(body: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>('/api/security/password', body);
  }

  sessions(): Observable<SessionDto[]> {
    return this.http
      .get<unknown>('/api/security/sessions')
      .pipe(map((b) => SessionDtoSchema.array().parse(b)));
  }

  revokeSession(id: string): Observable<void> {
    return this.http.delete<void>(`/api/security/sessions/${id}`);
  }

  revokeOtherSessions(): Observable<void> {
    return this.http.post<void>('/api/security/sessions/revoke-others', null);
  }
}
