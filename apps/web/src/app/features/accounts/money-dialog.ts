import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  type AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
} from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  type AccountDto,
  DescriptionSchema,
  RupeeInputSchema,
} from '@neobank/shared/models';
import { formatInr } from '@neobank/shared/utils';
import {
  AccountNumberPipe,
  Button,
  FormField,
  InrPipe,
  Input,
  zodValidator,
} from '@neobank/web/ui';
import { AccountsStore } from '../../core/accounts/accounts.store';
import { toApiError } from '../../core/http/api-error';

export type MoneyAction = 'deposit' | 'withdraw';

/**
 * Add money / Withdraw dialog, opened with NgbModal:
 *   const ref = modal.open(MoneyDialog);
 *   ref.componentInstance.setup(account, 'deposit');
 *   const result = await ref.result; // MoneyMovementResponse
 */
@Component({
  selector: 'nb-money-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    FormField,
    Input,
    InrPipe,
    AccountNumberPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title h5">{{ title() }}</h2>
        <button
          type="button"
          class="btn-close"
          aria-label="Close"
          (click)="activeModal.dismiss()"
        ></button>
      </div>

      <div class="modal-body">
        @if (account(); as account) {
          <p class="text-body-secondary small">
            {{ account.accountNumber | accountNumber }} · Available
            {{ account.balance | inr }}
          </p>
        }

        @if (error(); as error) {
          <div class="alert alert-danger" role="alert">{{ error }}</div>
        }

        <nb-form-field label="Amount (₹)" hint="Up to ₹1,00,000 at a time.">
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
            formControlName="description"
            [placeholder]="action() === 'deposit' ? 'e.g. Salary' : 'e.g. ATM'"
          />
        </nb-form-field>
      </div>

      <div class="modal-footer">
        <button
          nbButton
          type="button"
          variant="outline-secondary"
          (click)="activeModal.dismiss()"
        >
          Cancel
        </button>
        <button
          nbButton
          type="submit"
          [variant]="action() === 'deposit' ? 'success' : 'primary'"
          [loading]="pending()"
        >
          {{ title() }}
        </button>
      </div>
    </form>
  `,
})
export class MoneyDialog {
  protected readonly activeModal = inject(NgbActiveModal);
  private readonly store = inject(AccountsStore);

  protected readonly account = signal<AccountDto | null>(null);
  protected readonly action = signal<MoneyAction>('deposit');
  protected readonly title = computed(() =>
    this.action() === 'deposit' ? 'Add money' : 'Withdraw',
  );
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  /**
   * One Idempotency-Key per dialog: if the response is lost and the user
   * presses the button again, the API replays the first result instead of
   * moving the money twice. (A failed request saves nothing, so retrying
   * with a corrected amount is fine.)
   */
  private readonly idempotencyKey = crypto.randomUUID();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    amount: [
      '',
      [
        zodValidator(RupeeInputSchema),
        (c: AbstractControl) => this.withinBalance(c),
      ],
    ],
    description: ['', zodValidator(DescriptionSchema)],
  });

  setup(account: AccountDto, action: MoneyAction): void {
    this.account.set(account);
    this.action.set(action);
  }

  async submit(): Promise<void> {
    const account = this.account();
    if (!account || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { amount, description } = this.form.getRawValue();
    const request = {
      amountPaise: RupeeInputSchema.parse(amount),
      description,
    };

    this.pending.set(true);
    this.error.set(null);
    try {
      const result =
        this.action() === 'deposit'
          ? await this.store.deposit(account.id, request, this.idempotencyKey)
          : await this.store.withdraw(account.id, request, this.idempotencyKey);
      this.activeModal.close(result);
    } catch (err) {
      this.error.set(toApiError(err).message);
    } finally {
      this.pending.set(false);
    }
  }

  /** Friendly early check; the API enforces it again atomically. */
  private withinBalance(control: AbstractControl): ValidationErrors | null {
    const account = this.account();
    if (this.action() !== 'withdraw' || !account) return null;
    const parsed = RupeeInputSchema.safeParse(control.value);
    return parsed.success && parsed.data > account.balance
      ? { zod: `Insufficient funds (available ${formatInr(account.balance)})` }
      : null;
  }
}
