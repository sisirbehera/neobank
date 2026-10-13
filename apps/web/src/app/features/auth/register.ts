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
import { LanguageService } from '../../core/i18n/language.service';

function matchesPassword(control: AbstractControl): ValidationErrors | null {
  const password = control.parent?.get('password')?.value;
  return control.value === password
    ? null
    : {
        mismatch: $localize`:@@common.passwordsDoNotMatch:Passwords do not match`,
      };
}

@Component({
  selector: 'nb-register',
  imports: [ReactiveFormsModule, RouterLink, Card, Button, FormField, Input],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row justify-content-center">
      <div class="col-12 col-sm-10 col-md-7 col-lg-5">
        <nb-card
          title="Open your NeoBank account"
          i18n-title="@@register.title"
        >
          @if (error(); as error) {
            <div class="alert alert-danger" role="alert">{{ error }}</div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <nb-form-field label="Full name" i18n-label="@@register.fullName">
              <input
                nbInput
                id="name"
                autocomplete="name"
                formControlName="name"
              />
            </nb-form-field>

            <nb-form-field label="Email" i18n-label="@@common.email">
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
              i18n-label="@@common.password"
              hint="At least 8 characters, with a letter and a number."
              i18n-hint="@@common.passwordHint"
            >
              <input
                nbInput
                id="password"
                type="password"
                autocomplete="new-password"
                formControlName="password"
              />
            </nb-form-field>

            <nb-form-field
              label="Confirm password"
              i18n-label="@@register.confirmPassword"
            >
              <input
                nbInput
                id="confirmPassword"
                type="password"
                autocomplete="new-password"
                formControlName="confirmPassword"
              />
            </nb-form-field>

            <button
              nbButton
              type="submit"
              class="w-100"
              [loading]="pending()"
              i18n="@@register.submit"
            >
              Create account
            </button>
          </form>

          <p class="mt-3 mb-0 text-center small" i18n="@@register.loginPrompt">
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
  /** Saved on the profile: the language they signed up in. */
  private readonly language = inject(LanguageService).current;

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
      await this.store.register({
        name,
        email,
        password,
        language: this.language,
      });
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
