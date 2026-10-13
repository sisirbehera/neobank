import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import type { NotificationDto } from '@neobank/shared/models';
import { describeNotification } from './notification-text';
import { NotificationsStore } from './notifications.store';

/** The bell in the navbar: unread count, and the newest notifications. */
@Component({
  selector: 'nb-notification-bell',
  imports: [NgbDropdownModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      ngbDropdown
      placement="bottom-end"
      (openChange)="$event && store.load()"
    >
      <button
        type="button"
        class="btn btn-sm btn-outline-light position-relative"
        ngbDropdownToggle
        [attr.aria-label]="label()"
        data-testid="notification-bell"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2M8 1.9l-.8.2A4 4 0 0 0 4 6c0 .6-.1 2.2-.5 3.7-.2.8-.4 1.5-.7 2.3h10.4c-.3-.8-.5-1.5-.7-2.3C12.1 8.2 12 6.6 12 6a4 4 0 0 0-3.2-3.9zM14.2 12c.2.4.5.8.8 1H1c.3-.2.6-.6.8-1 .9-1.8 1.2-5 1.2-6a5 5 0 0 1 4-4.9 1 1 0 1 1 2 0A5 5 0 0 1 13 6c0 1 .3 4.2 1.2 6"
          />
        </svg>
        @if (store.unreadCount()) {
          <span
            class="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger"
            data-testid="notification-count"
            aria-hidden="true"
            >{{ store.unreadCount() > 9 ? '9+' : store.unreadCount() }}</span
          >
        }
      </button>

      <div ngbDropdownMenu class="nb-notifications p-0">
        <div
          class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom"
        >
          <strong class="small" i18n="@@notifications.title"
            >Notifications</strong
          >
          @if (store.unreadCount()) {
            <button
              type="button"
              class="btn btn-link btn-sm p-0"
              (click)="store.markAllRead()"
              i18n="@@notifications.markAllRead"
            >
              Mark all as read
            </button>
          }
        </div>
        @for (n of store.items(); track n.id) {
          <button
            type="button"
            ngbDropdownItem
            class="py-2 border-bottom text-wrap"
            [class.fw-semibold]="!n.read"
            (click)="open(n)"
            data-testid="notification"
          >
            @if (!n.read) {
              <span class="nb-unread-dot" aria-hidden="true"></span>
            }
            <span class="small">{{ view(n).text }}</span>
            <small class="d-block text-body-secondary fw-normal">{{
              n.createdAt | date: 'd MMM, h:mm a'
            }}</small>
          </button>
        } @empty {
          <p class="text-body-secondary small px-3 py-3 mb-0">
            {{ store.loaded() ? emptyText : loadingText }}
          </p>
        }
      </div>
    </div>
  `,
  styles: `
    .nb-notifications {
      width: min(22rem, calc(100vw - 2rem));
      max-height: 70vh;
      overflow-y: auto;
    }
    .nb-unread-dot {
      display: inline-block;
      width: 0.5rem;
      height: 0.5rem;
      margin-right: 0.35rem;
      border-radius: 50%;
      background: var(--bs-primary);
      vertical-align: 0.1rem;
    }
  `,
})
export class NotificationBell {
  protected readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);
  private readonly locale = inject(LOCALE_ID);

  protected readonly label = computed(() => {
    const count = this.store.unreadCount();
    return count
      ? $localize`:@@notifications.bellLabelUnread:Notifications, ${count}:count: unread`
      : $localize`:@@notifications.bellLabel:Notifications`;
  });
  protected readonly emptyText = $localize`:@@notifications.none:No notifications yet.`;
  protected readonly loadingText = $localize`:@@common.loading:Loading…`;

  protected view(n: NotificationDto) {
    return describeNotification(n, this.locale);
  }

  protected async open(n: NotificationDto): Promise<void> {
    await this.router.navigateByUrl(this.view(n).link);
    await this.store.markRead(n.id);
  }
}
