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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  DAILY_EXTERNAL_TRANSFER_LIMIT_PAISE,
  DescriptionSchema,
  RupeeInputSchema,
  TransferRequestSchema,
  type TransferResponse,
} from '@neobank/shared/models';
import { formatInr } from '@neobank/shared/utils';
import {
  AccountNumberPipe,
  Button,
  Card,
  FormField,
  InrPipe,
  Input,
  zodValidator,
} from '@neobank/web/ui';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';
import { AccountsStore } from '../../core/accounts/accounts.store';
import { BeneficiariesStore } from '../../core/beneficiaries/beneficiaries.store';
import { toApiError } from '../../core/http/api-error';
import { TransfersApi } from '../../core/transfers/transfers.api';
import { ACCOUNT_TYPE_LABELS } from '../accounts/labels';

type Step = 'details' | 'review' | 'done';

interface Party {
  name: string;
  accountNumber: string;
}

interface Summary {
  from: Party & { id: string };
  to: Party & { external: boolean };
  amountPaise: number;
  description: string;
}

@Component({
  selector: 'nb-transfer',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Card,
    Button,
    FormField,
    Input,
    InrPipe,
    AccountNumberPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row justify-content-center">
      <div class="col-12 col-md-9 col-lg-6">
        @switch (step()) {
          @case ('details') {
            <nb-card title="Transfer money" subtitle="Step 1 of 2 · Details">
              @if (accounts.loaded() && sources().length === 0) {
                <div class="alert alert-info mb-0">
                  You need an active account with money in it first.
                  <a routerLink="/accounts/new">Open an account</a>
                </div>
              } @else {
                <form [formGroup]="form" (ngSubmit)="review()" novalidate>
                  <nb-form-field label="From">
                    <select nbInput id="from" formControlName="fromAccountId">
                      @for (a of sources(); track a.id) {
                        <option [value]="a.id">
                          {{ a.nickname || typeLabels[a.type] }} ·
                          {{ a.accountNumber | accountNumber: 'masked' }} —
                          {{ a.balance | inr }}
                        </option>
                      }
                    </select>
                  </nb-form-field>

                  <nb-form-field label="To">
                    <select nbInput id="to" formControlName="toAccountNumber">
                      <option value="" disabled>Choose who to pay</option>
                      @if (ownDestinations().length) {
                        <optgroup label="My accounts">
                          @for (a of ownDestinations(); track a.id) {
                            <option [value]="a.accountNumber">
                              {{ a.nickname || typeLabels[a.type] }} ·
                              {{ a.accountNumber | accountNumber: 'masked' }}
                            </option>
                          }
                        </optgroup>
                      }
                      @if (beneficiaries.entities().length) {
                        <optgroup label="Beneficiaries">
                          @for (b of beneficiaries.entities(); track b.id) {
                            <option [value]="b.accountNumber">
                              {{ b.name }} ·
                              {{ b.accountNumber | accountNumber: 'masked' }}
                            </option>
                          }
                        </optgroup>
                      }
                    </select>
                  </nb-form-field>
                  <p class="small text-body-secondary">
                    Paying someone new?
                    <a routerLink="/beneficiaries">Add a beneficiary</a> first.
                  </p>

                  <nb-form-field
                    label="Amount (₹)"
                    [hint]="
                      toIsExternal()
                        ? 'Up to ' + dailyLimit + ' a day to other people.'
                        : 'Up to ₹1,00,000 per transfer.'
                    "
                  >
                    <input
                      nbInput
                      id="amount"
                      inputmode="decimal"
                      autocomplete="off"
                      placeholder="0.00"
                      formControlName="amount"
                    />
                  </nb-form-field>

                  <nb-form-field label="Description (optional)">
                    <input
                      nbInput
                      id="description"
                      autocomplete="off"
                      placeholder="e.g. Rent for October"
                      formControlName="description"
                    />
                  </nb-form-field>

                  <button nbButton type="submit" class="w-100">Continue</button>
                </form>
              }
            </nb-card>
          }

          @case ('review') {
            <nb-card title="Review transfer" subtitle="Step 2 of 2 · Confirm">
              @if (summary(); as s) {
                <dl class="row mb-3">
                  <dt class="col-4">From</dt>
                  <dd class="col-8">
                    {{ s.from.name }}<br />
                    <small class="font-monospace text-body-secondary">{{
                      s.from.accountNumber | accountNumber
                    }}</small>
                  </dd>
                  <dt class="col-4">To</dt>
                  <dd class="col-8">
                    {{ s.to.name }}<br />
                    <small class="font-monospace text-body-secondary">{{
                      s.to.accountNumber | accountNumber
                    }}</small>
                  </dd>
                  <dt class="col-4">Amount</dt>
                  <dd
                    class="col-8 fs-4 fw-semibold"
                    data-testid="review-amount"
                  >
                    {{ s.amountPaise | inr }}
                  </dd>
                  @if (s.description) {
                    <dt class="col-4">Description</dt>
                    <dd class="col-8">{{ s.description }}</dd>
                  }
                </dl>
              }

              @if (error(); as error) {
                <div class="alert alert-danger" role="alert">{{ error }}</div>
              }

              <div class="d-flex gap-2 justify-content-end">
                <button
                  nbButton
                  variant="outline-secondary"
                  [disabled]="pending()"
                  (click)="step.set('details')"
                >
                  Back
                </button>
                <button nbButton [loading]="pending()" (click)="confirm()">
                  Confirm transfer
                </button>
              </div>
            </nb-card>
          }

          @case ('done') {
            @if (summary(); as s) {
              <nb-card>
                <div class="text-center py-3">
                  <div class="display-6 text-success" aria-hidden="true">✓</div>
                  <h1 class="h4">Transfer complete</h1>
                  <p class="mb-1">
                    <strong>{{ s.amountPaise | inr }}</strong> sent to
                    {{ s.to.name }}.
                  </p>
                  @if (result(); as r) {
                    <p class="text-body-secondary small">
                      New balance of {{ s.from.name }}:
                      <strong data-testid="new-balance">{{
                        r.fromAccount.balance | inr
                      }}</strong
                      ><br />
                      Reference
                      <span class="font-monospace">{{ r.transactionId }}</span>
                    </p>
                  }
                  <div class="d-flex gap-2 justify-content-center">
                    <button
                      nbButton
                      variant="outline-primary"
                      (click)="another()"
                    >
                      Make another transfer
                    </button>
                    <a nbButton [routerLink]="['/accounts', s.from.id]"
                      >View account</a
                    >
                  </div>
                </div>
              </nb-card>
            }
          }
        }
      </div>
    </div>
  `,
})
export class Transfer {
  /** Optional ?from=<accountId> and ?to=<accountNumber> to prefill the form. */
  readonly from = input<string>();
  readonly to = input<string>();

  protected readonly accounts = inject(AccountsStore);
  protected readonly beneficiaries = inject(BeneficiariesStore);
  private readonly api = inject(TransfersApi);

  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;
  protected readonly dailyLimit = formatInr(
    DAILY_EXTERNAL_TRANSFER_LIMIT_PAISE,
  );

  protected readonly step = signal<Step>('details');
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = signal<Summary | null>(null);
  protected readonly result = signal<TransferResponse | null>(null);

  /** New key each time the user reaches "Review"; reused if Confirm is retried. */
  private idempotencyKey = '';

  protected readonly form = inject(FormBuilder).nonNullable.group({
    fromAccountId: [
      '',
      zodValidator(TransferRequestSchema.shape.fromAccountId),
    ],
    toAccountNumber: ['', zodValidator(z.string().min(1, 'Choose who to pay'))],
    amount: [
      '',
      [
        zodValidator(RupeeInputSchema),
        (c: AbstractControl) => this.withinBalance(c),
      ],
    ],
    description: ['', zodValidator(DescriptionSchema)],
  });

  private readonly fromId = toSignal(
    this.form.controls.fromAccountId.valueChanges,
    { initialValue: '' },
  );
  private readonly toNumber = toSignal(
    this.form.controls.toAccountNumber.valueChanges,
    { initialValue: '' },
  );

  protected readonly sources = computed(() =>
    this.accounts.entities().filter((a) => a.status === 'ACTIVE'),
  );
  protected readonly ownDestinations = computed(() =>
    this.sources().filter((a) => a.id !== this.fromId()),
  );
  protected readonly toIsExternal = computed(
    () =>
      !!this.toNumber() &&
      !this.accounts
        .entities()
        .some((a) => a.accountNumber === this.toNumber()),
  );

  constructor() {
    void this.accounts.load(true);
    void this.beneficiaries.load();

    // Prefill from the query string once accounts have loaded.
    effect(() => {
      if (!this.accounts.loaded()) return;
      const from = this.from();
      const to = this.to();
      untracked(() => {
        const controls = this.form.controls;
        if (!controls.fromAccountId.value) {
          // ?from= if given, otherwise the account with the most money.
          const richest = [...this.sources()].sort(
            (a, b) => b.balance - a.balance,
          )[0];
          const preferred =
            from && this.accounts.entityMap()[from]
              ? from
              : (richest?.id ?? '');
          controls.fromAccountId.setValue(preferred);
        }
        if (to && !controls.toAccountNumber.value) {
          controls.toAccountNumber.setValue(
            to.replace(/\s/g, '').toUpperCase(),
          );
        }
      });
    });

    // A different paying account: re-check the amount, and don't pay into itself.
    this.form.controls.fromAccountId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((id) => {
        const { toAccountNumber, amount } = this.form.controls;
        if (
          this.accounts.entityMap()[id]?.accountNumber === toAccountNumber.value
        ) {
          toAccountNumber.setValue('');
        }
        amount.updateValueAndValidity();
      });
  }

  review(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { fromAccountId, toAccountNumber, amount, description } =
      this.form.getRawValue();
    const from = this.accounts.entityMap()[fromAccountId];
    if (!from) return;

    this.summary.set({
      from: { id: from.id, ...this.describe(from.accountNumber) },
      to: {
        ...this.describe(toAccountNumber),
        external: this.toIsExternal(),
      },
      amountPaise: RupeeInputSchema.parse(amount),
      description: description.trim(),
    });
    this.idempotencyKey = crypto.randomUUID();
    this.error.set(null);
    this.step.set('review');
  }

  async confirm(): Promise<void> {
    const s = this.summary();
    if (!s) return;

    this.pending.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.api.transfer(
          {
            fromAccountId: s.from.id,
            toAccountNumber: s.to.accountNumber,
            amountPaise: s.amountPaise,
            description: s.description,
          },
          this.idempotencyKey,
        ),
      );
      this.accounts.setAccount(result.fromAccount);
      // Paid into one of our own accounts: refresh its balance too.
      if (!s.to.external) void this.accounts.load(true);
      this.result.set(result);
      this.step.set('done');
    } catch (err) {
      this.error.set(toApiError(err).message);
    } finally {
      this.pending.set(false);
    }
  }

  another(): void {
    this.form.patchValue({ toAccountNumber: '', amount: '', description: '' });
    this.form.markAsUntouched();
    this.result.set(null);
    this.summary.set(null);
    this.step.set('details');
  }

  /** Display name for one of my accounts or a beneficiary. */
  private describe(accountNumber: string): Party {
    const own = this.accounts
      .entities()
      .find((a) => a.accountNumber === accountNumber);
    if (own) {
      return { name: own.nickname || this.typeLabels[own.type], accountNumber };
    }
    const beneficiary = this.beneficiaries
      .entities()
      .find((b) => b.accountNumber === accountNumber);
    return { name: beneficiary?.name ?? accountNumber, accountNumber };
  }

  /** Friendly early check; the API enforces it again atomically. */
  private withinBalance(control: AbstractControl): ValidationErrors | null {
    const from =
      this.accounts?.entityMap()[this.form?.controls.fromAccountId.value];
    const parsed = RupeeInputSchema.safeParse(control.value);
    return from && parsed.success && parsed.data > from.balance
      ? { zod: `Insufficient funds (available ${formatInr(from.balance)})` }
      : null;
  }
}
