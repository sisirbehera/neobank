import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import type { NotificationDto } from '@neobank/shared/models';
import { AuthStore } from '../auth/auth.store';
import { session } from '../auth/auth.testing';
import { ToastService } from '../toast/toast.service';
import { NotificationsStore } from './notifications.store';

const money = (id: string, from: string): NotificationDto => ({
  id,
  type: 'MONEY_RECEIVED',
  data: {
    amountPaise: '250000',
    from,
    accountId: 'a1',
    account: '•••• 7897',
  },
  read: false,
  createdAt: new Date().toISOString(),
});

describe('NotificationsStore', () => {
  let store: InstanceType<typeof NotificationsStore>;
  let http: HttpTestingController;
  const toasts = () =>
    TestBed.inject(ToastService)
      .toasts()
      .map((t) => t.text);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: 'en-IN' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    patchState(unprotected(TestBed.inject(AuthStore)), {
      ...session(),
      status: 'authenticated',
    });
    store = TestBed.inject(NotificationsStore);
    TestBed.tick(); // signed in: the first check starts
  });

  const answerSummary = (unreadCount: number, latestId: string | null) =>
    http
      .expectOne('/api/notifications/summary')
      .flush({ unreadCount, latestId });

  it('shows the unread count, without toasts for what was already there', async () => {
    answerSummary(2, 'n1');
    await vi.waitFor(() => expect(store.unreadCount()).toBe(2));

    http.expectNone('/api/notifications');
    expect(toasts()).toEqual([]);
  });

  it('shows a toast, in words, for each new notification', async () => {
    answerSummary(1, 'n1');
    await vi.waitFor(() => expect(store.latestId()).toBe('n1'));

    const next = store.check();
    answerSummary(2, 'n2');
    await vi.waitFor(() =>
      http.expectOne('/api/notifications').flush({
        items: [money('n2', 'Ravi Kumar'), money('n1', 'Asha Rao')],
        unreadCount: 2,
      }),
    );
    await next;

    expect(toasts()).toEqual([
      '₹2,500.00 received from Ravi Kumar in •••• 7897',
    ]);
    expect(store.items().map((n) => n.id)).toEqual(['n2', 'n1']);
  });

  it('does nothing more when nothing changed', async () => {
    answerSummary(0, null);
    await vi.waitFor(() => expect(store.latestId()).toBeNull());

    const next = store.check();
    answerSummary(0, null);
    await next;

    http.expectNone('/api/notifications');
    expect(toasts()).toEqual([]);
  });
});
