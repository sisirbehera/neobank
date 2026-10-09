import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LedgerEntryDto } from '@neobank/shared/models';
import { AccountNumberPipe, Button, Card, InrPipe } from '@neobank/web/ui';
import { firstValueFrom } from 'rxjs';
import { AccountsApi } from '../../core/accounts/accounts.api';
import { AccountsStore } from '../../core/accounts/accounts.store';
import { AuthStore } from '../../core/auth/auth.store';
import { ActivityList } from '../accounts/activity-list';
import { ACCOUNT_TYPE_LABELS } from '../accounts/labels';

@Component({
  selector: 'nb-dashboard',
  imports: [RouterLink, Card, Button, InrPipe, AccountNumberPipe, ActivityList],
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

      <nb-card title="Recent activity">
        <nb-activity-list
          [entries]="activity()"
          [accounts]="accounts.entityMap()"
        />
      </nb-card>
    }
  `,
  styles: `
    .nb-total {
      background: var(--nb-primary);
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

  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;
  protected readonly activity = signal<LedgerEntryDto[]>([]);

  constructor() {
    // Always refresh balances when the dashboard opens.
    void this.accounts.load(true);
    void this.loadActivity();
  }

  private async loadActivity(): Promise<void> {
    try {
      this.activity.set(await firstValueFrom(this.api.activity(undefined, 5)));
    } catch {
      // The accounts error banner already covers API problems.
    }
  }
}
