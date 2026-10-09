import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  EmailSchema,
  NameSchema,
  NewPasswordSchema,
} from '@neobank/shared/models';
import {
  applyServerErrors,
  Button,
  Card,
  FormField,
  Input,
  zodValidator,
} from '@neobank/web/ui';
import { AuthStore } from '../../core/auth/auth.store';
import { toApiError } from '../../core/http/api-error';

function matchesPassword(control: AbstractControl): ValidationErrors | null {
  const password = control.parent?.get('password')?.value;
  return control.value === password
    ? null
    : { mismatch: 'Passwords do not match' };
}

@Component({
  selector: 'nb-register',
  imports: [ReactiveFormsModule, RouterLink, Card, Button, FormField, Input],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row justify-content-center">
      <div class="col-12 col-sm-10 col-md-7 col-lg-5">
        <nb-card title="Open your NeoBank account">
          @if (error(); as error) {
            <div class="alert alert-danger" role="alert">{{ error }}</div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <nb-form-field label="Full name">
              <input
                nbInput
                id="name"
                autocomplete="name"
                formControlName="name"
              />
            </nb-form-field>

            <nb-form-field label="Email">
              <input
                nbInput
                id="email"
                type="email"
                autocomplete="email"
                formControlName="email"
              />
            </nb-form-field>

            <nb-form-field
              label="Password"
              hint="At least 8 characters, with a letter and a number."
            >
              <input
                nbInput
                id="password"
                type="password"
                autocomplete="new-password"
                formControlName="password"
              />
            </nb-form-field>

            <nb-form-field label="Confirm password">
              <input
                nbInput
                id="confirmPassword"
                type="password"
                autocomplete="new-password"
                formControlName="confirmPassword"
              />
            </nb-form-field>

            <button nbButton type="submit" class="w-100" [loading]="pending()">
              Create account
            </button>
          </form>

          <p class="mt-3 mb-0 text-center small">
            Already have an account? <a routerLink="/login">Log in</a>
          </p>
        </nb-card>
      </div>
    </div>
  `,
})
export class Register {
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', zodValidator(NameSchema)],
    email: ['', zodValidator(EmailSchema)],
    password: ['', zodValidator(NewPasswordSchema)],
    confirmPassword: ['', matchesPassword],
  });
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Re-check "confirm password" whenever the password changes.
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() =>
        this.form.controls.confirmPassword.updateValueAndValidity(),
      );
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.pending.set(true);
    this.error.set(null);
    try {
      const { name, email, password } = this.form.getRawValue();
      await this.store.register({ name, email, password });
      await this.router.navigateByUrl('/dashboard');
    } catch (err) {
      const apiError = toApiError(err);
      applyServerErrors(this.form, apiError.fields);
      if (!apiError.fields) this.error.set(apiError.message);
    } finally {
      this.pending.set(false);
    }
  }
}
