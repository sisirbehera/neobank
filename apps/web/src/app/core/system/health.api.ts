import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { HealthResponse, HealthResponseSchema } from '@neobank/shared/models';
import { catchError, map, Observable, of, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class HealthApi {
  private readonly http = inject(HttpClient);

  /** The API answers 503 (with a normal body) when the database is down. */
  get(): Observable<HealthResponse> {
    return this.http.get<unknown>('/api/health').pipe(
      catchError((err: unknown) =>
        err instanceof HttpErrorResponse && err.status === 503
          ? of(err.error)
          : throwError(() => err),
      ),
      // Validate at the boundary with the same schema the API uses.
      map((body) => HealthResponseSchema.parse(body)),
    );
  }
}
