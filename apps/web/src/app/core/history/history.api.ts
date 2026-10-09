import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  type HistoryPage,
  HistoryPageSchema,
  type HistoryQuery,
  type MonthlySummary,
  MonthlySummarySchema,
} from '@neobank/shared/models';
import { firstValueFrom, map, Observable } from 'rxjs';

/** Drops empty filters so the URL stays clean. */
export function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class HistoryApi {
  private readonly http = inject(HttpClient);

  list(query: HistoryQuery): Observable<HistoryPage> {
    return this.http
      .get<unknown>('/api/transactions', { params: toParams(query) })
      .pipe(map((body) => HistoryPageSchema.parse(body)));
  }

  summary(): Observable<MonthlySummary> {
    return this.http
      .get<unknown>('/api/transactions/summary')
      .pipe(map((body) => MonthlySummarySchema.parse(body)));
  }

  /**
   * Downloads the CSV statement. It needs the Bearer token, so a plain
   * <a href> won't do: fetch it as a Blob and save it via a temporary link.
   */
  async downloadCsv(query: HistoryQuery): Promise<void> {
    const filters = { ...query, page: undefined, pageSize: undefined };
    const response = await firstValueFrom(
      this.http.get('/api/transactions/export.csv', {
        params: toParams(filters),
        responseType: 'blob',
        observe: 'response',
      }),
    );
    const filename =
      /filename="([^"]+)"/.exec(
        response.headers.get('Content-Disposition') ?? '',
      )?.[1] ?? 'neobank-statement.csv';

    const url = URL.createObjectURL(response.body as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
