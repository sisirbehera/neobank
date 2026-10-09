import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import type {
  AdminTransactionRow,
  AdminTransactionsQuery,
  Page,
} from '@neobank/shared/models';
import { AccountNumberPipe, InrPipe, Input } from '@neobank/web/ui';
import { firstValueFrom } from 'rxjs';
import { AdminApi } from '../../core/admin/admin.api';
import { toApiError } from '../../core/http/api-error';
import { TRANSACTION_TYPE_LABELS } from '../accounts/labels';

@Component({
  selector: 'nb-admin-transactions',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    NgbPagination,
    InrPipe,
    Input,
    AccountNumberPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row mb-3">
      <div class="col-6 col-md-3">
        <label class="form-label small mb-1" for="tx-type">Type</label>
        <select nbInput id="tx-type" [formControl]="type">
          <option value="">All types</option>
          @for (t of types; track t.value) {
            <option [value]="t.value">{{ t.label }}</option>
          }
        </select>
      </div>
    </div>

    @if (error(); as error) {
      <div class="alert alert-danger" role="alert">{{ error }}</div>
    }

    <section class="card shadow-sm">
      <div class="card-body">
        @if (result(); as r) {
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Type</th>
                  <th scope="col">From</th>
                  <th scope="col">To</th>
                  <th scope="col" class="text-end">Amount</th>
                  <th scope="col">By</th>
                </tr>
              </thead>
              <tbody>
                @for (t of r.items; track t.id) {
                  <tr>
                    <td class="small text-nowrap">
                      {{ t.createdAt | date: 'd MMM y, h:mm a' }}
                    </td>
                    <td>
                      {{ labels[t.type] }}
                      @if (t.isExternal) {
                        <span class="badge text-bg-light border ms-1"
                          >external</span
                        >
                      }
                      @if (t.description) {
                        <div class="small text-body-secondary">
                          {{ t.description }}
                        </div>
                      }
                    </td>
                    <td class="small font-monospace text-nowrap">
                      {{ t.fromAccountNumber | accountNumber: 'masked' }}
                    </td>
                    <td class="small font-monospace text-nowrap">
                      {{ t.toAccountNumber | accountNumber: 'masked' }}
                    </td>
                    <td class="text-end text-nowrap">{{ t.amount | inr }}</td>
                    <td class="small">{{ t.initiatedBy }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="text-body-secondary">
                      No transactions.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (r.total > r.pageSize) {
            <ngb-pagination
              class="d-flex justify-content-end mt-3"
              size="sm"
              [collectionSize]="r.total"
              [pageSize]="r.pageSize"
              [page]="r.page"
              [maxSize]="5"
              (pageChange)="load($event)"
            />
          }
        } @else {
          <p class="text-body-secondary mb-0">Loading…</p>
        }
      </div>
    </section>
  `,
})
export class AdminTransactions {
  private readonly api = inject(AdminApi);

  protected readonly labels = TRANSACTION_TYPE_LABELS;
  protected readonly types = Object.entries(TRANSACTION_TYPE_LABELS).map(
    ([value, label]) => ({ value, label }),
  );
  protected readonly type = new FormControl('', { nonNullable: true });
  protected readonly result = signal<Page<AdminTransactionRow> | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.load(1);
    this.type.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this.load(1));
  }

  async load(page: number): Promise<void> {
    try {
      this.result.set(
        await firstValueFrom(
          this.api.transactions({
            type: this.type.value as AdminTransactionsQuery['type'],
            page,
          }),
        ),
      );
      this.error.set(null);
    } catch (err) {
      this.error.set(toApiError(err).message);
    }
  }
}
