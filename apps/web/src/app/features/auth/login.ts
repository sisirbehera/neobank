import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LoginRequestSchema } from '@neobank/shared/models';
import {
  applyServerErrors,
  Button,
  Card,
  FormField,
  Input,
  zodValidator,
} from '@neobank/web/ui';
import { safeReturnUrl } from '../../core/auth/auth.guards';
import { AuthStore } from '../../core/auth/auth.store';
import { toApiError } from '../../core/http/api-error';

@Component({
  selector: 'nb-login',
  imports: [ReactiveFormsModule, RouterLink, Card, Button, FormField, Input],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row justify-content-center">
      <div class="col-12 col-sm-10 col-md-7 col-lg-5">
        <nb-card title="Log in to NeoBank">
          @if (error(); as error) {
            <div class="alert alert-danger" role="alert">{{ error }}</div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <nb-form-field label="Email">
              <input
                nbInput
                id="email"
                type="email"
                autocomplete="email"
                formControlName="email"
              />
            </nb-form-field>

            <nb-form-field label="Password">
              <input
                nbInput
                id="password"
                type="password"
                autocomplete="current-password"
                formControlName="password"
              />
            </nb-form-field>

            <button nbButton type="submit" class="w-100" [loading]="pending()">
              Log in
            </button>
          </form>

          <p class="mt-3 mb-0 text-center small">
            New to NeoBank? <a routerLink="/register">Open an account</a>
          </p>
        </nb-card>
      </div>
    </div>
  `,
})
export class Login {
  /** Bound from the ?returnUrl= query parameter (withComponentInputBinding). */
  readonly returnUrl = input<string>();

  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', zodValidator(LoginRequestSchema.shape.email)],
    password: ['', zodValidator(LoginRequestSchema.shape.password)],
  });
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.pending.set(true);
    this.error.set(null);
    try {
      await this.store.login(this.form.getRawValue());
      await this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
    } catch (err) {
      const apiError = toApiError(err);
      applyServerErrors(this.form, apiError.fields);
      if (!apiError.fields) this.error.set(apiError.message);
    } finally {
      this.pending.set(false);
    }
  }
}
