import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  type NotificationsPage,
  NotificationsPageSchema,
  type NotificationSummary,
  NotificationSummarySchema,
} from '@neobank/shared/models';
import { map, Observable } from 'rxjs';

/** /api/notifications: the signed-in user's in-app notifications. */
@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<NotificationsPage> {
    return this.http
      .get<unknown>('/api/notifications')
      .pipe(map((b) => NotificationsPageSchema.parse(b)));
  }

  summary(): Observable<NotificationSummary> {
    return this.http
      .get<unknown>('/api/notifications/summary')
      .pipe(map((b) => NotificationSummarySchema.parse(b)));
  }

  markRead(id: string): Observable<void> {
    return this.http.post<void>(`/api/notifications/${id}/read`, null);
  }

  markAllRead(): Observable<void> {
    return this.http.post<void>('/api/notifications/read-all', null);
  }
}
