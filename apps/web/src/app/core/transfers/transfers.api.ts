import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  IDEMPOTENCY_HEADER,
  type TransferRequest,
  type TransferResponse,
  TransferResponseSchema,
} from '@neobank/shared/models';
import { map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TransfersApi {
  private readonly http = inject(HttpClient);

  /** Reuse the same `idempotencyKey` when retrying the same transfer. */
  transfer(
    body: TransferRequest,
    idempotencyKey: string,
  ): Observable<TransferResponse> {
    return this.http
      .post<unknown>('/api/transfers', body, {
        headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      })
      .pipe(map((res) => TransferResponseSchema.parse(res)));
  }
}
