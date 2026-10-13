import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import type {
  SecurityEventDto,
  SecurityEventType,
} from '@neobank/shared/models';
import { Button, Card } from '@neobank/web/ui';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../../core/http/api-error';
import { SecurityApi } from '../../core/security/security.api';
import { describeDevice } from './device';

/** What each event means to the customer, and whether it deserves a look. */
const EVENTS: Record<SecurityEventType, { label: string; warn?: boolean }> = {
  SIGNED_IN: { label: $localize`:@@securityActivity.event.signedIn:Signed in` },
  SIGN_IN_FAILED: {
    label: $localize`:@@securityActivity.event.signInFailed:Failed sign-in attempt`,
    warn: true,
  },
  ACCOUNT_LOCKED: {
    label: $localize`:@@securityActivity.event.accountLocked:Locked for 15 minutes after too many wrong attempts`,
    warn: true,
  },
  PASSWORD_CHANGED: {
    label: $localize`:@@securityActivity.event.passwordChanged:Password changed`,
  },
  MFA_ENABLED: {
    label: $localize`:@@securityActivity.event.mfaEnabled:Two-step verification turned on`,
  },
  MFA_DISABLED: {
    label: $localize`:@@securityActivity.event.mfaDisabled:Two-step verification turned off`,
    warn: true,
  },
  BACKUP_CODES_REGENERATED: {
    label: $localize`:@@securityActivity.event.backupCodesRegenerated:New backup codes created`,
  },
  DEVICE_SIGNED_OUT: {
    label: $localize`:@@securityActivity.event.deviceSignedOut:A device was signed out`,
  },
  OTHER_DEVICES_SIGNED_OUT: {
    label: $localize`:@@common.otherDevicesSignedOut:All other devices signed out`,
  },
  STOLEN_SESSION_BLOCKED: {
    label: $localize`:@@securityActivity.event.stolenSessionBlocked:A copied sign-in was blocked, so every device was signed out`,
    warn: true,
  },
};

@Component({
  selector: 'nb-activity-card',
  imports: [DatePipe, Card, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nb-card
      title="Recent security activity"
      i18n-title="@@securityActivity.title"
      subtitle="Sign-ins and changes from the last 90 days. Don't recognise something? Change your password."
      i18n-subtitle="@@securityActivity.subtitle"
    >
      <button
        cardActions
        nbButton
        size="sm"
        variant="outline-primary"
        [loading]="loading()"
        (click)="reload()"
        i18n="@@common.refresh"
      >
        Refresh
      </button>

      @if (error(); as error) {
        <div class="alert alert-danger" role="alert">{{ error }}</div>
      }

      <ul class="list-group list-group-flush" data-testid="security-activity">
        @for (e of events(); track e.id) {
          <li class="list-group-item px-0">
            <div class="fw-medium" [class.text-danger]="info(e).warn">
              {{ info(e).label }}
              @if (e.current) {
                <span
                  class="badge text-bg-success ms-1"
                  i18n="@@common.thisDevice"
                  >This device</span
                >
              }
            </div>
            <small class="text-body-secondary">
              {{ e.createdAt | date: 'd MMM, h:mm a' }}
              @if (e.userAgent) {
                · {{ device(e.userAgent) }}
              }
              @if (e.ip) {
                · {{ e.ip }}
              }
            </small>
          </li>
        } @empty {
          @if (!loading()) {
            <li
              class="list-group-item px-0 text-body-secondary"
              i18n="@@securityActivity.empty"
            >
              Nothing yet.
            </li>
          }
        }
      </ul>
    </nb-card>
  `,
})
export class ActivityCard {
  private readonly api = inject(SecurityApi);

  protected readonly events = signal<SecurityEventDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly device = describeDevice;
  protected readonly info = (e: SecurityEventDto) => EVENTS[e.type];

  constructor() {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.events.set(await firstValueFrom(this.api.activity()));
    } catch (err) {
      this.error.set(toApiError(err).message);
    } finally {
      this.loading.set(false);
    }
  }
}
