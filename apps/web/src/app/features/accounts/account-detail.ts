import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import type {
  LedgerEntryDto,
  MoneyMovementResponse,
} from '@neobank/shared/models';
import { AccountNumberPipe, Button, Card, InrPipe } from '@neobank/web/ui';
import { firstValueFrom } from 'rxjs';
import { AccountsApi } from '../../core/accounts/accounts.api';
import { AccountsStore } from '../../core/accounts/accounts.store';
import { toApiError } from '../../core/http/api-error';
import { ActivityList } from './activity-list';
import { ACCOUNT_TYPE_LABELS } from './labels';
import { type MoneyAction, MoneyDialog } from './money-dialog';

@Component({
  selector: 'nb-account-detail',
  imports: [
    DatePipe,
    RouterLink,
    Card,
    Button,
    InrPipe,
    AccountNumberPipe,
    ActivityList,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="mb-3 small">
      <a routerLink="/dashboard">← Dashboard</a>
    </nav>

    @if (account(); as account) {
      <section class="card shadow-sm mb-4">
        <div class="card-body d-flex flex-wrap gap-3 justify-content-between">
          <div>
            <div class="text-body-secondary small">
              {{ typeLabels[account.type] }}
              @if (account.nickname) {
                · {{ account.nickname }}
              }
            </div>
            <h1 class="display-6 fw-semibold my-1" data-testid="balance">
              {{ account.balance | inr }}
            </h1>
            <div class="d-flex align-items-center gap-2 small">
              <span class="font-monospace">{{
                account.accountNumber | accountNumber
              }}</span>
              <button
                type="button"
                class="btn btn-link btn-sm p-0"
                (click)="copy(account.accountNumber)"
              >
                {{ copied() ? 'Copied' : 'Copy' }}
              </button>
              @if (account.status !== 'ACTIVE') {
                <span class="badge text-bg-warning text-capitalize">{{
                  account.status.toLowerCase()
                }}</span>
              }
            </div>
            <div class="small text-body-secondary mt-1">
              Opened {{ account.createdAt | date: 'mediumDate' }}
            </div>
          </div>

          <div class="d-flex align-items-start gap-2">
            <button
              nbButton
              variant="success"
              [disabled]="account.status !== 'ACTIVE'"
              (click)="openDialog('deposit')"
            >
              Add money
            </button>
            <button
              nbButton
              variant="outline-primary"
              [disabled]="account.status !== 'ACTIVE' || account.balance === 0"
              (click)="openDialog('withdraw')"
            >
              Withdraw
            </button>
            @if (account.status === 'ACTIVE' && account.balance > 0) {
              <a
                nbButton
                variant="outline-primary"
                routerLink="/transfer"
                [queryParams]="{ from: account.id }"
                >Transfer</a
              >
            }
          </div>
        </div>
      </section>

      <nb-card title="Recent activity">
        <a
          cardActions
          class="small"
          routerLink="/transactions"
          [queryParams]="{ accountId: account.id }"
          >View all</a
        >
        @if (activityError(); as error) {
          <div class="alert alert-danger mb-0">{{ error }}</div>
        } @else {
          <nb-activity-list
            [entries]="activity()"
            emptyText="No transactions yet. Add money to get started."
          />
        }
      </nb-card>
    } @else if (store.loaded()) {
      <div class="alert alert-warning">
        Account not found. <a routerLink="/dashboard">Back to dashboard</a>
      </div>
    } @else if (store.error(); as error) {
      <div class="alert alert-danger">{{ error }}</div>
    } @else {
      <p class="text-body-secondary">Loading…</p>
    }
  `,
})
export class AccountDetail {
  /** Route parameter :id (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly store = inject(AccountsStore);
  private readonly api = inject(AccountsApi);
  private readonly modal = inject(NgbModal);

  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;
  protected readonly account = computed(
    () => this.store.entityMap()[this.id()],
  );
  protected readonly activity = signal<LedgerEntryDto[]>([]);
  protected readonly activityError = signal<string | null>(null);
  protected readonly copied = signal(false);

  constructor() {
    void this.store.load();

    // Reload the activity whenever the route switches to another account.
    effect(() => {
      const id = this.id();
      untracked(() => void this.loadActivity(id));
    });
  }

  async openDialog(action: MoneyAction): Promise<void> {
    const account = this.account();
    if (!account) return;

    const ref = this.modal.open(MoneyDialog, { centered: true });
    (ref.componentInstance as MoneyDialog).setup(account, action);

    try {
      const result: MoneyMovementResponse = await ref.result;
      this.activity.update((entries) =>
        [result.entry, ...entries].slice(0, 20),
      );
    } catch {
      // Dialog dismissed: nothing to do.
    }
  }

  async copy(accountNumber: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(accountNumber);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Clipboard can be unavailable (e.g. insecure context); ignore.
    }
  }

  private async loadActivity(id: string): Promise<void> {
    this.activityError.set(null);
    try {
      this.activity.set(await firstValueFrom(this.api.activity(id, 20)));
    } catch (err) {
      this.activityError.set(toApiError(err).message);
    }
  }
}
