import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
} from '@angular/forms';
import { NewPasswordSchema } from '@neobank/shared/models';
import {
  applyServerErrors,
  Button,
  Card,
  FormField,
  Input,
  zodValidator,
} from '@neobank/web/ui';
import { firstValueFrom } from 'rxjs';
import * as z from 'zod/mini';
import { toApiError } from '../../core/http/api-error';
import { SecurityApi } from '../../core/security/security.api';

function matchesNewPassword(control: AbstractControl): ValidationErrors | null {
  return control.value === control.parent?.get('newPassword')?.value
    ? null
    : { mismatch: 'Passwords do not match' };
}

@Component({
  selector: 'nb-password-card',
  imports: [ReactiveFormsModule, Card, Button, FormField, Input],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nb-card title="Change password">
      @if (done()) {
        <div class="alert alert-success" role="status">
          Password changed. Your other devices were signed out.
        </div>
      }
      @if (error(); as error) {
        <div class="alert alert-danger" role="alert">{{ error }}</div>
      }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <nb-form-field label="Current password">
          <input
            nbInput
            id="currentPassword"
            type="password"
            autocomplete="current-password"
            formControlName="currentPassword"
          />
        </nb-form-field>
        <nb-form-field
          label="New password"
          hint="At least 8 characters, with a letter and a number."
        >
          <input
            nbInput
            id="newPassword"
            type="password"
            autocomplete="new-password"
            formControlName="newPassword"
          />
        </nb-form-field>
        <nb-form-field label="Confirm new password">
          <input
            nbInput
            id="confirmNewPassword"
            type="password"
            autocomplete="new-password"
            formControlName="confirmPassword"
          />
        </nb-form-field>
        <button nbButton type="submit" [loading]="pending()">
          Change password
        </button>
      </form>
    </nb-card>
  `,
})
export class PasswordCard {
  /** Fired after a change, so the sessions list can refresh. */
  readonly changed = output<void>();

  private readonly api = inject(SecurityApi);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    currentPassword: [
      '',
      zodValidator(
        z.string().check(z.minLength(1, 'Current password is required')),
      ),
    ],
    newPassword: ['', zodValidator(NewPasswordSchema)],
    confirmPassword: ['', matchesNewPassword],
  });
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal(false);

  constructor() {
    this.form.controls.newPassword.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() =>
        this.form.controls.confirmPassword.updateValueAndValidity(),
      );
  }

  async submit(): Promise<void> {
    this.done.set(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    try {
      const { currentPassword, newPassword } = this.form.getRawValue();
      await firstValueFrom(
        this.api.changePassword({ currentPassword, newPassword }),
      );
      this.form.reset();
      this.done.set(true);
      this.changed.emit();
    } catch (err) {
      const apiError = toApiError(err);
      applyServerErrors(this.form, apiError.fields);
      if (!apiError.fields) this.error.set(apiError.message);
    } finally {
      this.pending.set(false);
    }
  }
}
