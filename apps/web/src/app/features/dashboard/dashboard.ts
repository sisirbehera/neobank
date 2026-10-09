import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LedgerEntryDto, MonthlySummary } from '@neobank/shared/models';
import { formatInr, formatInrCompact } from '@neobank/shared/utils';
import {
  AccountNumberPipe,
  Button,
  Card,
  ColumnChart,
  InrPipe,
} from '@neobank/web/ui';
import { firstValueFrom } from 'rxjs';
import { AccountsApi } from '../../core/accounts/accounts.api';
import { AccountsStore } from '../../core/accounts/accounts.store';
import { AuthStore } from '../../core/auth/auth.store';
import { HistoryApi } from '../../core/history/history.api';
import { ActivityList } from '../accounts/activity-list';
import { ACCOUNT_TYPE_LABELS } from '../accounts/labels';

const SHORT_MONTH = new Intl.DateTimeFormat('en-IN', {
  month: 'short',
  timeZone: 'Asia/Kolkata',
});
const LONG_MONTH = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

@Component({
  selector: 'nb-dashboard',
  imports: [
    RouterLink,
    Card,
    Button,
    InrPipe,
    AccountNumberPipe,
    ActivityList,
    ColumnChart,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-4"
    >
      <h1 class="h3 mb-0">Hello, {{ auth.user()?.name }}</h1>
      @if (accounts.canOpenMore() && accounts.entities().length > 0) {
        <a nbButton routerLink="/accounts/new">Open account</a>
      }
    </header>

    @if (accounts.error(); as error) {
      <div class="alert alert-danger">
        {{ error }}
        <button
          type="button"
          class="btn btn-link p-0 ms-2"
          (click)="accounts.load(true)"
        >
          Retry
        </button>
      </div>
    } @else if (!accounts.loaded()) {
      <p class="text-body-secondary">Loading your accounts…</p>
    } @else if (accounts.entities().length === 0) {
      <section class="card shadow-sm">
        <div class="card-body text-center py-5">
          <h2 class="h5">You don't have any accounts yet</h2>
          <p class="text-body-secondary">
            Open a savings or current account in seconds.
          </p>
          <a nbButton routerLink="/accounts/new">Open your first account</a>
        </div>
      </section>
    } @else {
      <section class="card shadow-sm mb-4 border-0 nb-total">
        <div class="card-body">
          <div class="small opacity-75">Total balance</div>
          <div class="display-6 fw-semibold" data-testid="total-balance">
            {{ accounts.totalBalance() | inr }}
          </div>
          <div class="small opacity-75">
            across {{ accounts.entities().length }}
            {{ accounts.entities().length === 1 ? 'account' : 'accounts' }}
          </div>
        </div>
      </section>

      <div class="row g-3 mb-4">
        @for (account of accounts.entities(); track account.id) {
          <div class="col-12 col-sm-6 col-lg-4">
            <a
              class="card shadow-sm h-100 text-decoration-none nb-account-card"
              [routerLink]="['/accounts', account.id]"
            >
              <div class="card-body">
                <div class="d-flex justify-content-between small">
                  <span class="text-body-secondary">{{
                    typeLabels[account.type]
                  }}</span>
                  <span class="font-monospace text-body-secondary">{{
                    account.accountNumber | accountNumber: 'masked'
                  }}</span>
                </div>
                <div class="fw-medium mt-1 text-body">
                  {{ account.nickname || typeLabels[account.type] }}
                </div>
                <div class="fs-4 fw-semibold text-body">
                  {{ account.balance | inr }}
                </div>
                @if (account.status !== 'ACTIVE') {
                  <span class="badge text-bg-warning text-capitalize">{{
                    account.status.toLowerCase()
                  }}</span>
                }
              </div>
            </a>
          </div>
        }
      </div>

      <div class="row g-4">
        <div class="col-12 col-xl-7">
          <nb-card
            title="Money in and out"
            subtitle="Last 6 months · transfers between your own accounts excluded"
          >
            @if (chart(); as c) {
              <nb-column-chart
                caption="Money in and money out per month, last 6 months"
                [categories]="c.categories"
                [series]="c.series"
                [format]="formatInr"
                [formatTick]="formatInrCompact"
              />
            } @else {
              <p class="text-body-secondary mb-0">Loading…</p>
            }
          </nb-card>
        </div>
        <div class="col-12 col-xl-5">
          <nb-card title="Recent activity">
            <a cardActions class="small" routerLink="/transactions">View all</a>
            <nb-activity-list
              [entries]="activity()"
              [accounts]="accounts.entityMap()"
            />
          </nb-card>
        </div>
      </div>
    }
  `,
  styles: `
    .nb-total {
      background: var(--nb-primary-solid);
      color: #fff;
    }
    .nb-account-card {
      transition:
        transform 0.15s ease,
        box-shadow 0.15s ease;
    }
    .nb-account-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--bs-box-shadow) !important;
    }
  `,
})
export class Dashboard {
  protected readonly auth = inject(AuthStore);
  protected readonly accounts = inject(AccountsStore);
  private readonly api = inject(AccountsApi);

  private readonly historyApi = inject(HistoryApi);

  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;
  protected readonly activity = signal<LedgerEntryDto[]>([]);
  protected readonly formatInr = formatInr;
  protected readonly formatInrCompact = formatInrCompact;

  private readonly summary = signal<MonthlySummary | null>(null);
  protected readonly chart = computed(() => {
    const months = this.summary();
    if (!months) return null;
    return {
      categories: months.map(({ month }) => {
        const date = new Date(`${month}-15T12:00:00+05:30`);
        return {
          label: SHORT_MONTH.format(date),
          title: LONG_MONTH.format(date),
        };
      }),
      series: [
        { label: 'Money in', values: months.map((m) => m.inPaise) },
        { label: 'Money out', values: months.map((m) => m.outPaise) },
      ],
    };
  });

  constructor() {
    // Always refresh balances when the dashboard opens.
    void this.accounts.load(true);
    void this.loadActivity();
    void this.loadSummary();
  }

  private async loadSummary(): Promise<void> {
    try {
      this.summary.set(await firstValueFrom(this.historyApi.summary()));
    } catch {
      // The chart is optional; the rest of the dashboard still works.
    }
  }

  private async loadActivity(): Promise<void> {
    try {
      this.activity.set(await firstValueFrom(this.api.activity(undefined, 5)));
    } catch {
      // The accounts error banner already covers API problems.
    }
  }
}
