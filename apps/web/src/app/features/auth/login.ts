import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  DEMO_LOGIN,
  LoginRequestSchema,
  MfaCodeSchema,
  type MfaSetupResponse,
} from '@neobank/shared/models';
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
import { SystemStatusStore } from '../../core/system/system-status.store';
import { BackupCodesPanel } from '../security/backup-codes-panel';
import { MfaSetupPanel } from '../security/mfa-setup-panel';

/**
 * password → (code)                      users with 2FA
 * password → (set up 2FA → backup codes) admins without 2FA (mandatory)
 */
type Step = 'password' | 'code' | 'enroll' | 'backup-codes';

@Component({
  selector: 'nb-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Card,
    Button,
    FormField,
    Input,
    MfaSetupPanel,
    BackupCodesPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row justify-content-center">
      <div class="col-12 col-sm-10 col-md-7 col-lg-5">
        <nb-card [title]="title()">
          @if (error(); as error) {
            <div class="alert alert-danger" role="alert">{{ error }}</div>
          }

          @switch (step()) {
            @case ('password') {
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
                <button
                  nbButton
                  type="submit"
                  class="w-100"
                  [loading]="pending()"
                >
                  Log in
                </button>
              </form>

              <p class="mt-3 mb-0 text-center small">
                New to NeoBank? <a routerLink="/register">Open an account</a>
              </p>

              <!-- Below the form: it appears once /api/health answers, and
                   showing it above would push the form down (layout shift). -->
              @if (status.health()?.demoMode) {
                <div
                  class="alert alert-info small mt-3 mb-0 d-flex flex-wrap gap-2 align-items-center"
                >
                  <span>
                    Just looking? Use the demo account
                    <strong>{{ demo.email }}</strong> /
                    <strong>{{ demo.password }}</strong
                    >.
                  </span>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-primary"
                    (click)="useDemo()"
                  >
                    Fill in
                  </button>
                </div>
              }
            }

            @case ('code') {
              <p class="small">
                Enter the 6-digit code from your authenticator app.
              </p>
              <form [formGroup]="codeForm" (ngSubmit)="verify()" novalidate>
                <nb-form-field
                  label="Verification code"
                  hint="Lost your phone? Enter one of your backup codes."
                >
                  <input
                    nbInput
                    id="mfaCode"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    formControlName="code"
                  />
                </nb-form-field>
                <button
                  nbButton
                  type="submit"
                  class="w-100"
                  [loading]="pending()"
                >
                  Verify
                </button>
              </form>
              <button
                type="button"
                class="btn btn-link btn-sm mt-2 px-0"
                (click)="restart()"
              >
                ← Use a different account
              </button>
            }

            @case ('enroll') {
              <p class="small">
                Admin accounts must use two-step verification. Set it up now to
                continue.
              </p>
              @if (setup(); as s) {
                <nb-mfa-setup-panel
                  [setup]="s"
                  [pending]="pending()"
                  (confirmCode)="confirmEnroll($event)"
                />
              }
            }

            @case ('backup-codes') {
              <nb-backup-codes-panel
                [codes]="backupCodes()"
                (done)="finish()"
              />
            }
          }
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
  protected readonly status = inject(SystemStatusStore);
  protected readonly demo = DEMO_LOGIN;

  protected readonly step = signal<Step>('password');
  protected readonly title = computed(
    () =>
      ({
        password: 'Log in to NeoBank',
        code: 'Two-step verification',
        enroll: 'Set up two-step verification',
        'backup-codes': 'Your backup codes',
      })[this.step()],
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', zodValidator(LoginRequestSchema.shape.email)],
    password: ['', zodValidator(LoginRequestSchema.shape.password)],
  });
  protected readonly codeForm = inject(FormBuilder).nonNullable.group({
    code: ['', zodValidator(MfaCodeSchema)],
  });

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly setup = signal<MfaSetupResponse | null>(null);
  protected readonly backupCodes = signal<string[]>([]);
  private mfaToken = '';

  useDemo(): void {
    this.form.setValue({
      email: DEMO_LOGIN.email,
      password: DEMO_LOGIN.password,
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    await this.run(async () => {
      const challenge = await this.store.login(this.form.getRawValue());
      if (!challenge) return this.finish();

      this.mfaToken = challenge.mfaToken;
      if (challenge.method === 'VERIFY') {
        this.step.set('code');
      } else {
        this.setup.set(await this.store.enrollStart(challenge.mfaToken));
        this.step.set('enroll');
      }
    }, this.form);
  }

  async verify(): Promise<void> {
    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }
    await this.run(async () => {
      await this.store.verifyMfa(
        this.mfaToken,
        this.codeForm.getRawValue().code,
      );
      await this.finish();
    }, this.codeForm);
  }

  async confirmEnroll(code: string): Promise<void> {
    await this.run(async () => {
      this.backupCodes.set(await this.store.enrollConfirm(this.mfaToken, code));
      this.step.set('backup-codes');
    });
  }

  async finish(): Promise<void> {
    await this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
  }

  restart(): void {
    this.mfaToken = '';
    this.codeForm.reset();
    this.error.set(null);
    this.step.set('password');
  }

  /** Shared pending/error handling for each step. */
  private async run(
    action: () => Promise<unknown>,
    form?: typeof this.form | typeof this.codeForm,
  ): Promise<void> {
    this.pending.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (err) {
      const apiError = toApiError(err);
      if (apiError.code === 'MFA_TOKEN_INVALID') this.restart();
      if (form) applyServerErrors(form, apiError.fields);
      if (!form || !apiError.fields) this.error.set(apiError.message);
    } finally {
      this.pending.set(false);
    }
  }
}
