import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  type AccountDto,
  AccountDtoSchema,
  type AdminStats,
  AdminStatsSchema,
  type AdminTransactionRow,
  type AdminTransactionsQuery,
  AdminTransactionsPageSchema,
  type AdminUserDetail,
  AdminUserDetailSchema,
  type AdminUserRow,
  type AdminUsersQuery,
  AdminUsersPageSchema,
  type AuditEntryDto,
  AuditEntryDtoSchema,
  type Page,
  type UpdateAccountStatusRequest,
} from '@neobank/shared/models';
import { map, Observable } from 'rxjs';
import { toParams } from '../history/history.api';

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  stats(): Observable<AdminStats> {
    return this.http
      .get<unknown>('/api/admin/stats')
      .pipe(map((b) => AdminStatsSchema.parse(b)));
  }

  audit(): Observable<AuditEntryDto[]> {
    return this.http
      .get<unknown>('/api/admin/audit')
      .pipe(map((b) => AuditEntryDtoSchema.array().parse(b)));
  }

  users(query: AdminUsersQuery): Observable<Page<AdminUserRow>> {
    return this.http
      .get<unknown>('/api/admin/users', { params: toParams(query) })
      .pipe(map((b) => AdminUsersPageSchema.parse(b)));
  }

  user(id: string): Observable<AdminUserDetail> {
    return this.http
      .get<unknown>(`/api/admin/users/${id}`)
      .pipe(map((b) => AdminUserDetailSchema.parse(b)));
  }

  setAccountStatus(
    accountId: string,
    body: UpdateAccountStatusRequest,
  ): Observable<AccountDto> {
    return this.http
      .patch<unknown>(`/api/admin/accounts/${accountId}/status`, body)
      .pipe(map((b) => AccountDtoSchema.parse(b)));
  }

  transactions(
    query: AdminTransactionsQuery,
  ): Observable<Page<AdminTransactionRow>> {
    return this.http
      .get<unknown>('/api/admin/transactions', { params: toParams(query) })
      .pipe(map((b) => AdminTransactionsPageSchema.parse(b)));
  }

  resetDemo(): Observable<void> {
    return this.http.post<void>('/api/admin/demo/reset', null);
  }
}
