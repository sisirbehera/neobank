import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  type AccountType,
  MAX_ACCOUNTS_PER_USER,
  OpenAccountRequestSchema,
} from '@neobank/shared/models';
import { Button, Card, FormField, Input, zodValidator } from '@neobank/web/ui';
import { AccountsStore } from '../../core/accounts/accounts.store';
import { toApiError } from '../../core/http/api-error';

const TYPES: { value: AccountType; title: string; text: string }[] = [
  {
    value: 'SAVINGS',
    title: 'Savings account',
    text: 'For personal savings and everyday banking.',
  },
  {
    value: 'CURRENT',
    title: 'Current account',
    text: 'For frequent transactions and business use.',
  },
];

@Component({
  selector: 'nb-open-account',
  imports: [ReactiveFormsModule, RouterLink, Card, Button, FormField, Input],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row justify-content-center">
      <div class="col-12 col-md-9 col-lg-6">
        <nb-card title="Open a new account">
          @if (!store.canOpenMore()) {
            <div class="alert alert-info mb-0">
              You already have the maximum of {{ maxAccounts }} accounts.
              <a routerLink="/dashboard">Back to dashboard</a>
            </div>
          } @else {
            @if (error(); as error) {
              <div class="alert alert-danger" role="alert">{{ error }}</div>
            }

            <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
              <fieldset class="mb-3">
                <legend class="form-label fs-6">Account type</legend>
                <div class="row g-2">
                  @for (type of types; track type.value) {
                    <div class="col-12 col-sm-6">
                      <input
                        type="radio"
                        class="btn-check"
                        formControlName="type"
                        [id]="'type-' + type.value"
                        [value]="type.value"
                      />
                      <label
                        class="btn btn-outline-primary w-100 h-100 text-start p-3"
                        [for]="'type-' + type.value"
                      >
                        <span class="d-block fw-semibold">{{
                          type.title
                        }}</span>
                        <small>{{ type.text }}</small>
                      </label>
                    </div>
                  }
                </div>
              </fieldset>

              <nb-form-field
                label="Nickname (optional)"
                hint="Shown on your dashboard, e.g. “Rainy day fund”."
              >
                <input
                  nbInput
                  id="nickname"
                  autocomplete="off"
                  formControlName="nickname"
                />
              </nb-form-field>

              <div class="d-flex gap-2 justify-content-end">
                <a nbButton variant="outline-secondary" routerLink="/dashboard"
                  >Cancel</a
                >
                <button nbButton type="submit" [loading]="pending()">
                  Open account
                </button>
              </div>
            </form>
          }
        </nb-card>
      </div>
    </div>
  `,
})
export class OpenAccount {
  protected readonly store = inject(AccountsStore);
  private readonly router = inject(Router);

  protected readonly types = TYPES;
  protected readonly maxAccounts = MAX_ACCOUNTS_PER_USER;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    type: ['SAVINGS' as AccountType],
    nickname: ['', zodValidator(OpenAccountRequestSchema.shape.nickname)],
  });
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.store.load();
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.pending.set(true);
    this.error.set(null);
    try {
      const account = await this.store.open(this.form.getRawValue());
      await this.router.navigate(['/accounts', account.id]);
    } catch (err) {
      this.error.set(toApiError(err).message);
    } finally {
      this.pending.set(false);
    }
  }
}
