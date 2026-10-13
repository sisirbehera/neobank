import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  effect,
  inject,
  LOCALE_ID,
  PLATFORM_ID,
  untracked,
} from '@angular/core';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import type { NotificationDto, NotificationType } from '@neobank/shared/models';
import { firstValueFrom } from 'rxjs';
import { AccountsStore } from '../accounts/accounts.store';
import { AuthStore } from '../auth/auth.store';
import { resetOnUserChange } from '../state/reset-on-user-change';
import { ToastService } from '../toast/toast.service';
import { describeNotification } from './notification-text';
import { NotificationsApi } from './notifications.api';

/** How often to ask "anything new?" while the tab is visible. */
export const POLL_MS = 60_000;
/** A burst (e.g. after a long absence) shows at most this many toasts. */
const MAX_TOASTS = 3;
/** These change a balance or status: cached accounts are then out of date. */
const CHANGES_ACCOUNTS: NotificationType[] = [
  'MONEY_RECEIVED',
  'ACCOUNT_FROZEN',
  'ACCOUNT_UNFROZEN',
];

interface NotificationsState {
  items: NotificationDto[];
  unreadCount: number;
  /** Newest notification seen so far; undefined until the first check. */
  latestId: string | null | undefined;
  loaded: boolean;
}

const initialState: NotificationsState = {
  items: [],
  unreadCount: 0,
  latestId: undefined,
  loaded: false,
};

/**
 * The bell in the navbar (decision record 0014). No websockets: the app asks
 * for a small summary when it starts, when the tab comes back into view, and
 * every minute while it is visible. When the newest notification changes,
 * the new ones are fetched and shown as toasts.
 */
export const NotificationsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(
    (
      store,
      api = inject(NotificationsApi),
      toasts = inject(ToastService),
      locale = inject(LOCALE_ID),
      accounts = inject(AccountsStore),
    ) => ({
      /** The full list (for the open dropdown). */
      async load(): Promise<void> {
        const page = await firstValueFrom(api.list());
        patchState(store, {
          items: page.items,
          unreadCount: page.unreadCount,
          latestId: page.items[0]?.id ?? null,
          loaded: true,
        });
      },

      /** Cheap check; fetches the list and shows toasts only if something arrived. */
      async check(): Promise<void> {
        const summary = await firstValueFrom(api.summary());
        const previous = store.latestId();
        patchState(store, { unreadCount: summary.unreadCount });
        if (summary.latestId === previous) return;
        // First check after the page loaded: remember where we are, no toasts
        // for what was already there.
        if (previous === undefined) {
          patchState(store, { latestId: summary.latestId });
          return;
        }
        const page = await firstValueFrom(api.list());
        const seen = page.items.findIndex((n) => n.id === previous);
        const fresh = (seen < 0 ? page.items : page.items.slice(0, seen))
          .filter((n) => !n.read)
          .slice(0, MAX_TOASTS);
        for (const n of [...fresh].reverse()) {
          toasts.info(describeNotification(n, locale).text);
        }
        if (fresh.some((n) => CHANGES_ACCOUNTS.includes(n.type))) {
          void accounts.load(true);
        }
        patchState(store, {
          items: page.items,
          unreadCount: page.unreadCount,
          latestId: summary.latestId,
          loaded: true,
        });
      },

      async markRead(id: string): Promise<void> {
        const item = store.items().find((n) => n.id === id);
        if (!item || item.read) return;
        patchState(store, {
          items: store
            .items()
            .map((n) => (n.id === id ? { ...n, read: true } : n)),
          unreadCount: Math.max(0, store.unreadCount() - 1),
        });
        await firstValueFrom(api.markRead(id));
      },

      async markAllRead(): Promise<void> {
        patchState(store, {
          items: store.items().map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        });
        await firstValueFrom(api.markAllRead());
      },

      reset(): void {
        patchState(store, initialState);
      },
    }),
  ),
  withHooks({
    onInit(store) {
      resetOnUserChange(store);
      if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

      const auth = inject(AuthStore);
      const document = inject(DOCUMENT);
      const check = () => {
        if (auth.isAuthenticated() && document.visibilityState === 'visible') {
          // A failed check (offline, server asleep) just waits for the next one.
          store.check().catch(() => undefined);
        }
      };
      let timer: ReturnType<typeof setInterval> | undefined;
      const stop = () => {
        clearInterval(timer);
        timer = undefined;
        document.removeEventListener('visibilitychange', check);
      };

      effect(() => {
        const signedIn = auth.isAuthenticated();
        untracked(() => {
          stop();
          if (!signedIn) return;
          check();
          timer = setInterval(check, POLL_MS);
          document.addEventListener('visibilitychange', check);
        });
      });
      inject(DestroyRef).onDestroy(stop);
    },
  }),
);
