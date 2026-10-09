import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { AccountDto, LedgerEntryDto } from '@neobank/shared/models';
import { AccountNumberPipe, Amount, InrPipe } from '@neobank/web/ui';
import { TRANSACTION_TYPE_LABELS } from './labels';

/** Presentational list of ledger entries (no store, no HTTP). */
@Component({
  selector: 'nb-activity-list',
  imports: [DatePipe, Amount, InrPipe, AccountNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (entries().length === 0) {
      <p class="text-body-secondary mb-0">{{ emptyText() }}</p>
    } @else {
      <ul class="list-group list-group-flush">
        @for (entry of entries(); track entry.id) {
          <li
            class="list-group-item px-0 d-flex justify-content-between align-items-start gap-3"
          >
            <div style="min-width: 0">
              <div class="fw-medium text-truncate">
                {{ entry.description || labels[entry.type] }}
              </div>
              @if (entry.counterparty) {
                <div class="small text-truncate">
                  {{ entry.direction === 'DEBIT' ? 'To' : 'From' }}
                  {{ entry.counterparty }}
                </div>
              }
              <small class="text-body-secondary">
                {{ labels[entry.type] }} ·
                {{ entry.createdAt | date: 'd MMM y, h:mm a' }}
                @if (accounts()?.[entry.accountId]; as account) {
                  · {{ account.accountNumber | accountNumber: 'masked' }}
                }
              </small>
            </div>
            <div class="text-end text-nowrap">
              <nb-amount
                class="fw-semibold"
                [paise]="
                  entry.direction === 'CREDIT' ? entry.amount : -entry.amount
                "
                signed
              />
              <div class="small text-body-secondary">
                Bal {{ entry.balanceAfter | inr }}
              </div>
            </div>
          </li>
        }
      </ul>
    }
  `,
})
export class ActivityList {
  readonly entries = input.required<LedgerEntryDto[]>();
  /** Optional id → account map, to show which account each entry belongs to. */
  readonly accounts = input<Record<string, AccountDto>>();
  readonly emptyText = input('No transactions yet.');

  protected readonly labels = TRANSACTION_TYPE_LABELS;
}
