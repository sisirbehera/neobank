import {
  ChangeDetectionStrategy,
  Component,
  inject,
  type Injector,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MfaCodeSchema, type StepUpAction } from '@neobank/shared/models';
import { Button, FormField, Input, zodValidator } from '@neobank/web/ui';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../http/api-error';
import { SecurityApi } from './security.api';

const PROMPTS: Record<StepUpAction, string> = {
  ADD_BENEFICIARY: 'Adding a new beneficiary needs a fresh code.',
  LARGE_TRANSFER: 'Transfers over ₹10,000 to other people need a fresh code.',
};

/** Asks for a 2FA code and resolves with a step-up token (see stepUpInterceptor). */
@Component({
  selector: 'nb-step-up-dialog',
  imports: [ReactiveFormsModule, Button, FormField, Input],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title h5">Confirm it's you</h2>
        <button
          type="button"
          class="btn-close"
          aria-label="Close"
          (click)="activeModal.dismiss()"
        ></button>
      </div>
      <div class="modal-body">
        <p class="small">{{ prompt() }}</p>
        @if (error(); as error) {
          <div class="alert alert-danger" role="alert">{{ error }}</div>
        }
        <nb-form-field
          label="Code from your authenticator app"
          hint="Or one of your backup codes."
        >
          <input
            nbInput
            id="stepUpCode"
            inputmode="numeric"
            autocomplete="one-time-code"
            formControlName="code"
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
        <button nbButton type="submit" [loading]="pending()">Confirm</button>
      </div>
    </form>
  `,
})
export class StepUpDialog {
  protected readonly activeModal = inject(NgbActiveModal);
  private readonly api = inject(SecurityApi);

  private action: StepUpAction = 'ADD_BENEFICIARY';
  protected readonly prompt = signal('');
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    code: ['', zodValidator(MfaCodeSchema)],
  });

  setup(action: StepUpAction): void {
    this.action = action;
    this.prompt.set(PROMPTS[action]);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    try {
      const token = await firstValueFrom(
        this.api.stepUp(this.action, this.form.getRawValue().code),
      );
      this.activeModal.close(token);
    } catch (err) {
      this.error.set(toApiError(err).message);
      this.form.reset();
    } finally {
      this.pending.set(false);
    }
  }
}

/**
 * Opens the dialog and resolves with a step-up token (rejects if dismissed).
 * Lives in this lazily loaded file so the modal and forms code are only
 * downloaded when a step-up actually happens.
 */
export function openStepUpDialog(
  injector: Injector,
  action: StepUpAction,
): Promise<string> {
  const ref = injector.get(NgbModal).open(StepUpDialog, { centered: true });
  (ref.componentInstance as StepUpDialog).setup(action);
  return ref.result;
}
