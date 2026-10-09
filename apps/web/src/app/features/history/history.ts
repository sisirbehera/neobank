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
import {
  takeUntilDestroyed,
  toObservable,
  toSignal,
} from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import type { HistoryPage, HistoryQuery } from '@neobank/shared/models';
import {
  AccountNumberPipe,
  Amount,
  Button,
  InrPipe,
  Input,
} from '@neobank/web/ui';
import { catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';
import { AccountsStore } from '../../core/accounts/accounts.store';
import { HistoryApi } from '../../core/history/history.api';
import { toApiError } from '../../core/http/api-error';
import {
  ACCOUNT_TYPE_LABELS,
  TRANSACTION_TYPE_LABELS,
} from '../accounts/labels';

const PAGE_SIZE = 20;

/** The URL query string, as plain strings ("" = not set). */
interface UrlQuery {
  accountId: string;
  type: string;
  direction: string;
  from: string;
  to: string;
  q: string;
  page: number;
  pageSize: number;
}
const FILTERS = ['accountId', 'type', 'direction', 'from', 'to', 'q'] as const;

/**
 * Full transaction history. The filters live in the URL (?type=…&page=…), so a
 * filtered view can be bookmarked or shared and the Back button works.
 */
@Component({
  selector: 'nb-history',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    NgbPagination,
    Amount,
    Button,
    InrPipe,
    Input,
    AccountNumberPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3"
    >
      <h1 class="h3 mb-0">Transactions</h1>
      <button
        nbButton
        variant="outline-primary"
        [loading]="exporting()"
        [disabled]="!results()?.total"
        (click)="exportCsv()"
      >
        Export CSV
      </button>
    </header>

    <!-- Filters: one row above the results they scope -->
    <form
      class="row g-2 align-items-end mb-3"
      [formGroup]="filters"
      (ngSubmit)="$event.preventDefault()"
    >
      <div class="col-12 col-md-6 col-lg-4">
        <label class="form-label small mb-1" for="f-account">Account</label>
        <select nbInput id="f-account" formControlName="accountId">
          <option value="">All accounts</option>
          @for (a of accounts.entities(); track a.id) {
            <option [value]="a.id">
              {{ a.nickname || typeLabels[a.type] }} ·
              {{ a.accountNumber | accountNumber: 'masked' }}
            </option>
          }
        </select>
      </div>
      <div class="col-6 col-md-3 col-lg-2">
        <label class="form-label small mb-1" for="f-type">Type</label>
        <select nbInput id="f-type" formControlName="type">
          <option value="">All types</option>
          @for (t of types; track t.value) {
            <option [value]="t.value">{{ t.label }}</option>
          }
        </select>
      </div>
      <div class="col-6 col-md-3 col-lg-2">
        <label class="form-label small mb-1" for="f-direction">In / out</label>
        <select nbInput id="f-direction" formControlName="direction">
          <option value="">Both</option>
          <option value="CREDIT">Money in</option>
          <option value="DEBIT">Money out</option>
        </select>
      </div>
      <div class="col-6 col-md-3 col-lg-2">
        <label class="form-label small mb-1" for="f-from">From</label>
        <input nbInput id="f-from" type="date" formControlName="from" />
      </div>
      <div class="col-6 col-md-3 col-lg-2">
        <label class="form-label small mb-1" for="f-to">To</label>
        <input nbInput id="f-to" type="date" formControlName="to" />
      </div>
      <div class="col-12 col-md-6 col-lg-4 order-first">
        <label class="form-label small mb-1" for="f-q">Search</label>
        <input
          nbInput
          id="f-q"
          type="search"
          placeholder="Description or name"
          formControlName="q"
        />
      </div>
      @if (hasFilters()) {
        <div class="col-12">
          <button
            type="button"
            class="btn btn-link btn-sm p-0"
            (click)="clear()"
          >
            Clear filters
          </button>
        </div>
      }
    </form>

    <section class="card shadow-sm">
      <div class="card-body">
        @if (error(); as error) {
          <div class="alert alert-danger" role="alert">{{ error }}</div>
        }

        @if (results(); as p) {
          @if (p.items.length === 0) {
            <p class="text-body-secondary mb-0">
              No transactions match these filters.
            </p>
          } @else {
            <div
              class="table-responsive"
              [style.opacity]="loading() ? 0.5 : 1"
              [attr.aria-busy]="loading()"
            >
              <table class="table align-middle mb-0">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Description</th>
                    <th scope="col">Account</th>
                    <th scope="col" class="text-end">Amount</th>
                    <th scope="col" class="text-end d-none d-md-table-cell">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of p.items; track e.id) {
                    <tr>
                      <td class="text-nowrap small">
                        {{ e.createdAt | date: 'd MMM y, h:mm a' }}
                      </td>
                      <td>
                        <div>{{ e.description || txLabels[e.type] }}</div>
                        <small class="text-body-secondary">
                          {{ txLabels[e.type] }}
                          @if (e.counterparty) {
                            · {{ e.direction === 'DEBIT' ? 'To' : 'From' }}
                            {{ e.counterparty }}
                          }
                        </small>
                      </td>
                      <td class="small font-monospace text-nowrap">
                        {{
                          accountNumberOf(e.accountId) | accountNumber: 'masked'
                        }}
                      </td>
                      <td class="text-end text-nowrap">
                        <nb-amount
                          [paise]="
                            e.direction === 'CREDIT' ? e.amount : -e.amount
                          "
                          signed
                        />
                      </td>
                      <td
                        class="text-end text-nowrap small d-none d-md-table-cell"
                      >
                        {{ e.balanceAfter | inr }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div
              class="d-flex flex-wrap gap-2 justify-content-between align-items-center mt-3"
            >
              <small class="text-body-secondary">
                Showing {{ (p.page - 1) * p.pageSize + 1 }}–{{
                  (p.page - 1) * p.pageSize + p.items.length
                }}
                of {{ p.total }}
              </small>
              @if (p.total > p.pageSize) {
                <ngb-pagination
                  size="sm"
                  [collectionSize]="p.total"
                  [pageSize]="p.pageSize"
                  [page]="p.page"
                  [maxSize]="5"
                  [rotate]="true"
                  [boundaryLinks]="true"
                  (pageChange)="goToPage($event)"
                />
              }
            </div>
          }
        } @else if (!error()) {
          <p class="text-body-secondary mb-0">Loading…</p>
        }
      </div>
    </section>
  `,
})
export class History {
  // Query-string parameters (withComponentInputBinding).
  readonly accountId = input<string>();
  readonly type = input<string>();
  readonly direction = input<string>();
  readonly from = input<string>();
  readonly to = input<string>();
  readonly q = input<string>();
  readonly page = input<string>();

  protected readonly accounts = inject(AccountsStore);
  private readonly api = inject(HistoryApi);
  private readonly router = inject(Router);

  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;
  protected readonly txLabels = TRANSACTION_TYPE_LABELS;
  protected readonly types = Object.entries(TRANSACTION_TYPE_LABELS).map(
    ([value, label]) => ({ value, label }),
  );

  protected readonly filters = inject(FormBuilder).nonNullable.group({
    accountId: '',
    type: '',
    direction: '',
    from: '',
    to: '',
    q: '',
  });

  /** The current request, built only from the URL. */
  private readonly query = computed<UrlQuery>(() => ({
    accountId: this.accountId() ?? '',
    type: this.type() ?? '',
    direction: this.direction() ?? '',
    from: this.from() ?? '',
    to: this.to() ?? '',
    q: this.q() ?? '',
    page: Math.max(1, Number(this.page()) || 1),
    pageSize: PAGE_SIZE,
  }));

  protected readonly hasFilters = computed(() =>
    FILTERS.some((key) => !!this.query()[key]),
  );

  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Last successful page: kept on screen (dimmed) while the next one loads. */
  protected readonly results = signal<HistoryPage | null>(null);

  constructor() {
    void this.accounts.load();

    // URL → form (first load, Back/Forward).
    effect(() => {
      const q = this.query();
      untracked(() =>
        this.filters.patchValue(
          {
            accountId: q.accountId,
            type: q.type,
            direction: q.direction,
            from: q.from,
            to: q.to,
            q: q.q,
          },
          { emitEvent: false },
        ),
      );
    });

    // Form → URL (debounced so typing in Search doesn't flood the API).
    this.filters.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((value) => {
        const queryParams: Record<string, string | null> = { page: null };
        for (const key of FILTERS) queryParams[key] = value[key] || null;
        void this.router.navigate([], {
          queryParams,
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });

    // URL → data. switchMap cancels a slower, older request.
    toSignal(
      toObservable(this.query).pipe(
        tap(() => this.loading.set(true)),
        switchMap((query) =>
          this.api.list(query as HistoryQuery).pipe(
            map((page) => ({ page, error: null })),
            catchError((err) =>
              of({ page: null, error: toApiError(err).message }),
            ),
          ),
        ),
        tap(({ page, error }) => {
          this.loading.set(false);
          this.error.set(error);
          if (page) this.results.set(page);
        }),
      ),
    );
  }

  goToPage(page: number): void {
    void this.router.navigate([], {
      queryParams: { page: page > 1 ? page : null },
      queryParamsHandling: 'merge',
    });
  }

  clear(): void {
    this.filters.reset();
  }

  async exportCsv(): Promise<void> {
    this.exporting.set(true);
    this.error.set(null);
    try {
      await this.api.downloadCsv(this.query() as HistoryQuery);
    } catch (err) {
      this.error.set(toApiError(err).message);
    } finally {
      this.exporting.set(false);
    }
  }

  protected accountNumberOf(accountId: string): string {
    return this.accounts.entityMap()[accountId]?.accountNumber ?? '';
  }
}
