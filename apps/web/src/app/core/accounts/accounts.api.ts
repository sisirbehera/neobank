import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  type AccountDto,
  AccountDtoSchema,
  type LedgerEntryDto,
  LedgerEntryDtoSchema,
  type MoneyMovementRequest,
  type MoneyMovementResponse,
  MoneyMovementResponseSchema,
  type OpenAccountRequest,
} from '@neobank/shared/models';
import { map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AccountsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<AccountDto[]> {
    return this.http
      .get<unknown>('/api/accounts')
      .pipe(map((body) => AccountDtoSchema.array().parse(body)));
  }

  open(body: OpenAccountRequest): Observable<AccountDto> {
    return this.http
      .post<unknown>('/api/accounts', body)
      .pipe(map((res) => AccountDtoSchema.parse(res)));
  }

  deposit(id: string, body: MoneyMovementRequest) {
    return this.move(`/api/accounts/${id}/deposit`, body);
  }

  withdraw(id: string, body: MoneyMovementRequest) {
    return this.move(`/api/accounts/${id}/withdraw`, body);
  }

  /** Newest first. Without an account id: across all of the user's accounts. */
  activity(accountId?: string, limit = 10): Observable<LedgerEntryDto[]> {
    const url = accountId
      ? `/api/accounts/${accountId}/activity`
      : '/api/accounts/activity';
    return this.http
      .get<unknown>(url, { params: { limit } })
      .pipe(map((body) => LedgerEntryDtoSchema.array().parse(body)));
  }

  private move(
    url: string,
    body: MoneyMovementRequest,
  ): Observable<MoneyMovementResponse> {
    return this.http
      .post<unknown>(url, body)
      .pipe(map((res) => MoneyMovementResponseSchema.parse(res)));
  }
}
