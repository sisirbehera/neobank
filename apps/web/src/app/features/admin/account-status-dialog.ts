import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  type AccountDto,
  UpdateAccountStatusRequestSchema,
} from '@neobank/shared/models';
import {
  AccountNumberPipe,
  Button,
  FormField,
  Input,
  zodValidator,
} from '@neobank/web/ui';
import { firstValueFrom } from 'rxjs';
import { AdminApi } from '../../core/admin/admin.api';
import { toApiError } from '../../core/http/api-error';

/** Freeze or unfreeze an account. A reason is required (it goes into the audit log). */
@Component({
  selector: 'nb-account-status-dialog',
  imports: [ReactiveFormsModule, Button, FormField, Input, AccountNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title h5">
          {{ freezing() ? 'Freeze' : 'Unfreeze' }} account
        </h2>
        <button
          type="button"
          class="btn-close"
          aria-label="Close"
          (click)="activeModal.dismiss()"
        ></button>
      </div>
      <div class="modal-body">
        @if (account(); as a) {
          <p class="small">
            <span class="font-monospace">{{
              a.accountNumber | accountNumber
            }}</span>
            @if (freezing()) {
              — the customer will not be able to move money in or out until it
              is unfrozen.
            }
          </p>
        }
        @if (error(); as error) {
          <div class="alert alert-danger" role="alert">{{ error }}</div>
        }
        <nb-form-field label="Reason" hint="Recorded in the audit log.">
          <textarea
            nbInput
            id="reason"
            rows="3"
            formControlName="reason"
          ></textarea>
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
          [variant]="freezing() ? 'danger' : 'primary'"
          [loading]="pending()"
        >
          {{ freezing() ? 'Freeze' : 'Unfreeze' }}
        </button>
      </div>
    </form>
  `,
})
export class AccountStatusDialog {
  protected readonly activeModal = inject(NgbActiveModal);
  private readonly api = inject(AdminApi);

  protected readonly account = signal<AccountDto | null>(null);
  protected readonly freezing = computed(
    () => this.account()?.status === 'ACTIVE',
  );
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    reason: ['', zodValidator(UpdateAccountStatusRequestSchema.shape.reason)],
  });

  setup(account: AccountDto): void {
    this.account.set(account);
  }

  async submit(): Promise<void> {
    const account = this.account();
    if (!account || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    try {
      const updated = await firstValueFrom(
        this.api.setAccountStatus(account.id, {
          status: this.freezing() ? 'FROZEN' : 'ACTIVE',
          reason: this.form.getRawValue().reason,
        }),
      );
      this.activeModal.close(updated);
    } catch (err) {
      this.error.set(toApiError(err).message);
    } finally {
      this.pending.set(false);
    }
  }
}
