import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { SessionDto } from '@neobank/shared/models';
import { Button, Card } from '@neobank/web/ui';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../../core/http/api-error';
import { SecurityApi } from '../../core/security/security.api';
import { describeDevice } from './device';

@Component({
  selector: 'nb-sessions-card',
  imports: [DatePipe, Card, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nb-card
      title="Where you're signed in"
      subtitle="Signing out a device ends it within 15 minutes."
    >
      @if (error(); as error) {
        <div class="alert alert-danger" role="alert">{{ error }}</div>
      }

      <ul class="list-group list-group-flush">
        @for (s of sessions(); track s.id) {
          <li
            class="list-group-item px-0 d-flex flex-wrap gap-2 justify-content-between align-items-center"
          >
            <div>
              <div class="fw-medium">
                {{ device(s.userAgent) }}
                @if (s.current) {
                  <span class="badge text-bg-success ms-1">This device</span>
                }
                @if (s.mfa) {
                  <span class="badge text-bg-light border ms-1">2-step</span>
                }
              </div>
              <small class="text-body-secondary">
                {{ s.ip || 'Unknown IP' }} · signed in
                {{ s.startedAt | date: 'd MMM, h:mm a' }} · last active
                {{ s.lastActiveAt | date: 'd MMM, h:mm a' }}
              </small>
            </div>
            @if (!s.current) {
              <button
                nbButton
                size="sm"
                variant="outline-secondary"
                [attr.aria-label]="'Sign out ' + device(s.userAgent)"
                (click)="revoke(s.id)"
              >
                Sign out
              </button>
            }
          </li>
        }
      </ul>

      @if (others() > 0) {
        <button
          nbButton
          variant="outline-danger"
          class="mt-3"
          [loading]="pending()"
          (click)="revokeOthers()"
        >
          Sign out all other devices ({{ others() }})
        </button>
      }
    </nb-card>
  `,
})
export class SessionsCard {
  private readonly api = inject(SecurityApi);

  protected readonly sessions = signal<SessionDto[]>([]);
  protected readonly others = computed(
    () => this.sessions().filter((s) => !s.current).length,
  );
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly device = describeDevice;

  constructor() {
    void this.reload();
  }

  async reload(): Promise<void> {
    try {
      this.sessions.set(await firstValueFrom(this.api.sessions()));
    } catch (err) {
      this.error.set(toApiError(err).message);
    }
  }

  async revoke(id: string): Promise<void> {
    await this.act(() => firstValueFrom(this.api.revokeSession(id)));
  }

  async revokeOthers(): Promise<void> {
    await this.act(() => firstValueFrom(this.api.revokeOtherSessions()));
  }

  private async act(action: () => Promise<void>): Promise<void> {
    this.pending.set(true);
    this.error.set(null);
    try {
      await action();
      await this.reload();
    } catch (err) {
      this.error.set(toApiError(err).message);
    } finally {
      this.pending.set(false);
    }
  }
}
