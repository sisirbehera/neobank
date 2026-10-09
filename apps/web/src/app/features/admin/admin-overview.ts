import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import type { AdminStats, AuditEntryDto } from '@neobank/shared/models';
import { formatInr, formatInrCompact } from '@neobank/shared/utils';
import { Button, Card } from '@neobank/web/ui';
import { firstValueFrom } from 'rxjs';
import { AdminApi } from '../../core/admin/admin.api';
import { toApiError } from '../../core/http/api-error';
import { SystemStatusStore } from '../../core/system/system-status.store';

const ACTION_LABELS: Partial<Record<string, string>> = {
  ACCOUNT_FROZEN: 'Froze account',
  ACCOUNT_UNFROZEN: 'Unfroze account',
  DEMO_RESET: 'Reset demo data',
};

@Component({
  selector: 'nb-admin-overview',
  imports: [DatePipe, Card, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error(); as error) {
      <div class="alert alert-danger" role="alert">{{ error }}</div>
    }

    <!-- KPI row: label, then the value -->
    <div class="row g-3 mb-4">
      @for (tile of tiles(); track tile.label) {
        <div class="col-6 col-md-4 col-xl-2">
          <section class="card shadow-sm h-100">
            <div class="card-body">
              <h2 class="small text-body-secondary fw-normal mb-1">
                {{ tile.label }}
              </h2>
              <div class="fs-4 fw-semibold" [attr.title]="tile.title">
                {{ tile.value }}
              </div>
            </div>
          </section>
        </div>
      }
    </div>

    <div class="row g-4">
      <div class="col-12 col-lg-8">
        <nb-card title="Recent admin actions" subtitle="Audit log">
          @if (audit().length === 0) {
            <p class="text-body-secondary mb-0">No admin actions yet.</p>
          } @else {
            <ul class="list-group list-group-flush">
              @for (a of audit(); track a.id) {
                <li class="list-group-item px-0">
                  <div class="d-flex justify-content-between gap-2">
                    <strong>{{ actionLabels[a.action] ?? a.action }}</strong>
                    <small class="text-body-secondary text-nowrap">{{
                      a.createdAt | date: 'd MMM, h:mm a'
                    }}</small>
                  </div>
                  <div class="small">{{ a.target }}</div>
                  <small class="text-body-secondary">
                    by {{ a.adminName }}
                    @if (a.reason) {
                      · “{{ a.reason }}”
                    }
                  </small>
                </li>
              }
            </ul>
          }
        </nb-card>
      </div>

      @if (status.health()?.demoMode) {
        <div class="col-12 col-lg-4">
          <nb-card title="Demo data">
            <p class="small text-body-secondary">
              Deletes the demo users (and everything they own) and recreates
              them with fresh history. Other users are not affected.
            </p>
            @if (confirmReset()) {
              <div class="d-flex gap-2">
                <button
                  nbButton
                  variant="danger"
                  [loading]="resetting()"
                  (click)="reset()"
                >
                  Yes, reset
                </button>
                <button
                  nbButton
                  variant="outline-secondary"
                  [disabled]="resetting()"
                  (click)="confirmReset.set(false)"
                >
                  Cancel
                </button>
              </div>
            } @else {
              <button
                nbButton
                variant="outline-primary"
                (click)="confirmReset.set(true)"
              >
                Reset demo data
              </button>
            }
            @if (resetDone()) {
              <div class="alert alert-success small mt-3 mb-0" role="status">
                Demo data was reset.
              </div>
            }
          </nb-card>
        </div>
      }
    </div>
  `,
})
export class AdminOverview {
  private readonly api = inject(AdminApi);
  protected readonly status = inject(SystemStatusStore);

  protected readonly actionLabels = ACTION_LABELS;
  protected readonly tiles = signal<
    { label: string; value: string; title?: string }[]
  >([]);
  protected readonly audit = signal<AuditEntryDto[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmReset = signal(false);
  protected readonly resetting = signal(false);
  protected readonly resetDone = signal(false);

  constructor() {
    void this.load();
  }

  async reset(): Promise<void> {
    this.resetting.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.resetDemo());
      this.resetDone.set(true);
      this.confirmReset.set(false);
      await this.load();
    } catch (err) {
      this.error.set(toApiError(err).message);
    } finally {
      this.resetting.set(false);
    }
  }

  private async load(): Promise<void> {
    try {
      const [stats, audit] = await Promise.all([
        firstValueFrom(this.api.stats()),
        firstValueFrom(this.api.audit()),
      ]);
      this.tiles.set(toTiles(stats));
      this.audit.set(audit);
    } catch (err) {
      this.error.set(toApiError(err).message);
    }
  }
}

function toTiles(s: AdminStats) {
  return [
    { label: 'Users', value: s.users.toLocaleString('en-IN') },
    { label: 'Accounts', value: s.accounts.toLocaleString('en-IN') },
    {
      label: 'Frozen accounts',
      value: s.frozenAccounts.toLocaleString('en-IN'),
    },
    {
      label: 'Deposits held',
      value: formatInrCompact(s.totalBalance),
      title: formatInr(s.totalBalance),
    },
    {
      label: 'Transactions today',
      value: s.transactionsToday.toLocaleString('en-IN'),
    },
    {
      label: 'Volume today',
      value: formatInrCompact(s.volumeTodayPaise),
      title: formatInr(s.volumeTodayPaise),
    },
  ];
}
