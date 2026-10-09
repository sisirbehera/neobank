import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { inject } from '@angular/core';
import { type MfaSetupResponse, TotpCodeSchema } from '@neobank/shared/models';
import { Button, FormField, Input, zodValidator } from '@neobank/web/ui';

/**
 * Step 1: scan the QR code. Step 2: type the code the app shows.
 * Presentational: the parent calls the API with the emitted code.
 */
@Component({
  selector: 'nb-mfa-setup-panel',
  imports: [ReactiveFormsModule, Button, FormField, Input],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="ps-3 small">
      <li class="mb-2">
        Open an authenticator app (Google Authenticator, Microsoft
        Authenticator, Authy, 1Password…) and scan this code.
      </li>
      <li>Enter the 6-digit code it shows.</li>
    </ol>

    <div class="d-flex flex-wrap gap-3 align-items-center mb-3">
      <img
        class="border rounded bg-white p-1"
        width="168"
        height="168"
        [src]="setup().qrCodeDataUrl"
        alt="QR code for your authenticator app"
      />
      <div class="small">
        <div class="text-body-secondary">Can't scan? Enter this key:</div>
        <code
          class="d-block fs-6 user-select-all text-body"
          data-testid="mfa-secret"
          >{{ groupedSecret() }}</code
        >
      </div>
    </div>

    @if (error(); as error) {
      <div class="alert alert-danger" role="alert">{{ error }}</div>
    }

    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <nb-form-field label="6-digit code">
        <input
          nbInput
          id="setupCode"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          formControlName="code"
        />
      </nb-form-field>
      <button nbButton type="submit" [loading]="pending()">
        Turn on two-step verification
      </button>
    </form>
  `,
})
export class MfaSetupPanel {
  readonly setup = input.required<MfaSetupResponse>();
  readonly pending = input(false);
  readonly error = input<string | null>(null);
  readonly confirmCode = output<string>();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    code: ['', zodValidator(TotpCodeSchema)],
  });

  /** "ABCD EFGH IJKL …" is easier to type than one long string. */
  protected readonly groupedSecret = computed(() =>
    this.setup()
      .secret.replace(/(.{4})/g, '$1 ')
      .trim(),
  );

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.confirmCode.emit(this.form.getRawValue().code.trim());
  }
}
