import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MfaCodeSchema, type MfaSetupResponse } from '@neobank/shared/models';
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
import { AuthStore } from '../../core/auth/auth.store';
import { toApiError } from '../../core/http/api-error';
import { SecurityApi } from '../../core/security/security.api';
import { BackupCodesPanel } from './backup-codes-panel';
import { MfaSetupPanel } from './mfa-setup-panel';

type Mode = 'idle' | 'setup' | 'codes' | 'disable' | 'regenerate';

@Component({
  selector: 'nb-mfa-card',
  imports: [
    ReactiveFormsModule,
    Card,
    Button,
    FormField,
    Input,
    MfaSetupPanel,
    BackupCodesPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nb-card title="Two-step verification">
      <span
        cardActions
        class="badge"
        [class.text-bg-success]="auth.user()?.mfaEnabled"
        [class.text-bg-secondary]="!auth.user()?.mfaEnabled"
        >{{ auth.user()?.mfaEnabled ? 'On' : 'Off' }}</span
      >
      @if (auth.user(); as user) {
        @if (error(); as error) {
          <div class="alert alert-danger" role="alert">{{ error }}</div>
        }
        @if (notice(); as notice) {
          <div class="alert alert-success" role="status">{{ notice }}</div>
        }

        @switch (mode()) {
          @case ('setup') {
            @if (setup(); as s) {
              <nb-mfa-setup-panel
                [setup]="s"
                [pending]="pending()"
                (confirmCode)="enable($event)"
              />
            }
          }
          @case ('codes') {
            <nb-backup-codes-panel [codes]="backupCodes()" (done)="reset()" />
          }
          @case ('disable') {
            <form [formGroup]="disableForm" (ngSubmit)="disable()" novalidate>
              <nb-form-field label="Password">
                <input
                  nbInput
                  id="disablePassword"
                  type="password"
                  autocomplete="current-password"
                  formControlName="password"
                />
              </nb-form-field>
              <nb-form-field label="Code from your app (or a backup code)">
                <input
                  nbInput
                  id="disableCode"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  formControlName="code"
                />
              </nb-form-field>
              <div class="d-flex gap-2">
                <button
                  nbButton
                  type="submit"
                  variant="danger"
                  [loading]="pending()"
                >
                  Turn off
                </button>
                <button
                  nbButton
                  type="button"
                  variant="outline-secondary"
                  (click)="reset()"
                >
                  Cancel
                </button>
              </div>
            </form>
          }
          @case ('regenerate') {
            <form [formGroup]="codeForm" (ngSubmit)="regenerate()" novalidate>
              <p class="small">
                New codes replace your old ones (any unused old codes stop
                working).
              </p>
              <nb-form-field label="Code from your app">
                <input
                  nbInput
                  id="regenerateCode"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  formControlName="code"
                />
              </nb-form-field>
              <div class="d-flex gap-2">
                <button nbButton type="submit" [loading]="pending()">
                  Generate new codes
                </button>
                <button
                  nbButton
                  type="button"
                  variant="outline-secondary"
                  (click)="reset()"
                >
                  Cancel
                </button>
              </div>
            </form>
          }
          @default {
            @if (user.mfaEnabled) {
              <p class="small">
                You'll enter a code from your authenticator app when you sign
                in, add a beneficiary, or send more than ₹10,000 to someone
                else.
              </p>
              <div class="d-flex flex-wrap gap-2">
                <button
                  nbButton
                  variant="outline-primary"
                  (click)="mode.set('regenerate')"
                >
                  New backup codes
                </button>
                @if (user.role === 'admin') {
                  <small class="text-body-secondary align-self-center">
                    Required for admin accounts.
                  </small>
                } @else {
                  <button
                    nbButton
                    variant="outline-secondary"
                    (click)="mode.set('disable')"
                  >
                    Turn off
                  </button>
                }
              </div>
            } @else {
              <p class="small">
                Protect your account with a code from an authenticator app,
                asked when you sign in and before risky actions.
              </p>
              <button nbButton [loading]="pending()" (click)="startSetup()">
                Set up
              </button>
            }
          }
        }
      }
    </nb-card>
  `,
})
export class MfaCard {
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(SecurityApi);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly mode = signal<Mode>('idle');
  protected readonly setup = signal<MfaSetupResponse | null>(null);
  protected readonly backupCodes = signal<string[]>([]);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly disableForm = this.fb.group({
    password: [
      '',
      zodValidator(z.string().check(z.minLength(1, 'Password is required'))),
    ],
    code: ['', zodValidator(MfaCodeSchema)],
  });
  protected readonly codeForm = this.fb.group({
    code: ['', zodValidator(MfaCodeSchema)],
  });

  async startSetup(): Promise<void> {
    await this.run(async () => {
      this.setup.set(await firstValueFrom(this.api.mfaSetup()));
      this.mode.set('setup');
    });
  }

  async enable(code: string): Promise<void> {
    await this.run(async () => {
      this.backupCodes.set(await firstValueFrom(this.api.mfaEnable(code)));
      this.auth.setMfaEnabled(true);
      this.mode.set('codes');
    });
  }

  async disable(): Promise<void> {
    if (this.disableForm.invalid) return this.disableForm.markAllAsTouched();
    await this.run(async () => {
      await firstValueFrom(this.api.mfaDisable(this.disableForm.getRawValue()));
      this.auth.setMfaEnabled(false);
      this.reset();
      this.notice.set('Two-step verification is off.');
    }, this.disableForm);
  }

  async regenerate(): Promise<void> {
    if (this.codeForm.invalid) return this.codeForm.markAllAsTouched();
    await this.run(async () => {
      this.backupCodes.set(
        await firstValueFrom(
          this.api.regenerateBackupCodes(this.codeForm.getRawValue().code),
        ),
      );
      this.mode.set('codes');
    }, this.codeForm);
  }

  reset(): void {
    this.mode.set('idle');
    this.setup.set(null);
    this.backupCodes.set([]);
    this.error.set(null);
    this.notice.set(null);
    this.disableForm.reset();
    this.codeForm.reset();
  }

  private async run(
    action: () => Promise<void>,
    form?: typeof this.disableForm | typeof this.codeForm,
  ): Promise<void> {
    this.pending.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await action();
    } catch (err) {
      const apiError = toApiError(err);
      if (form) applyServerErrors(form, apiError.fields);
      if (!form || !apiError.fields) this.error.set(apiError.message);
    } finally {
      this.pending.set(false);
    }
  }
}
