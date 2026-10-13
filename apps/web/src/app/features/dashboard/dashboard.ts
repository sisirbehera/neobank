import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  LOCALE_ID,
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
      <h1 class="h3 mb-0" i18n>Hello, {{ auth.user()?.name }}</h1>
      @if (accounts.canOpenMore() && accounts.entities().length > 0) {
        <a nbButton routerLink="/accounts/new" i18n>Open account</a>
      }
    </header>

    @if (accounts.error(); as error) {
      <div class="alert alert-danger">
        {{ error }}
        <button
          type="button"
          class="btn btn-link p-0 ms-2"
          (click)="accounts.load(true)"
          i18n
        >
          Retry
        </button>
      </div>
    } @else if (!accounts.loaded()) {
      <p class="text-body-secondary" i18n>Loading your accounts…</p>
    } @else if (accounts.entities().length === 0) {
      <section class="card shadow-sm">
        <div class="card-body text-center py-5">
          <h2 class="h5" i18n>You don't have any accounts yet</h2>
          <p class="text-body-secondary" i18n>
            Open a savings or current account in seconds.
          </p>
          <a nbButton routerLink="/accounts/new" i18n
            >Open your first account</a
          >
        </div>
      </section>
    } @else {
      <section class="card shadow-sm mb-4 border-0 nb-total">
        <div class="card-body">
          <div class="small opacity-75" i18n>Total balance</div>
          <div class="display-6 fw-semibold" data-testid="total-balance">
            {{ accounts.totalBalance() | inr }}
          </div>
          <div class="small opacity-75" i18n>
            {accounts.entities().length, plural,
              =1 {across 1 account}
              other {across {{ accounts.entities().length }} accounts}
            }
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
            i18n-title
            subtitle="Last 6 months · transfers between your own accounts excluded"
            i18n-subtitle
          >
            @if (chart(); as c) {
              <nb-column-chart
                caption="Money in and money out per month, last 6 months"
                i18n-caption
                [categories]="c.categories"
                [series]="c.series"
                [format]="formatInr"
                [formatTick]="formatInrCompact"
              />
            } @else {
              <p class="text-body-secondary mb-0" i18n>Loading…</p>
            }
          </nb-card>
        </div>
        <div class="col-12 col-xl-5">
          <nb-card title="Recent activity" i18n-title>
            <a cardActions class="small" routerLink="/transactions" i18n
              >View all</a
            >
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
  private readonly locale = inject(LOCALE_ID);
  protected readonly formatInr = (paise: number) =>
    formatInr(paise, this.locale);
  protected readonly formatInrCompact = (paise: number) =>
    formatInrCompact(paise, this.locale);
  private readonly shortMonth = new Intl.DateTimeFormat(this.locale, {
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
  private readonly longMonth = new Intl.DateTimeFormat(this.locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  private readonly summary = signal<MonthlySummary | null>(null);
  protected readonly chart = computed(() => {
    const months = this.summary();
    if (!months) return null;
    return {
      categories: months.map(({ month }) => {
        const date = new Date(`${month}-15T12:00:00+05:30`);
        return {
          label: this.shortMonth.format(date),
          title: this.longMonth.format(date),
        };
      }),
      series: [
        { label: $localize`Money in`, values: months.map((m) => m.inPaise) },
        { label: $localize`Money out`, values: months.map((m) => m.outPaise) },
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
