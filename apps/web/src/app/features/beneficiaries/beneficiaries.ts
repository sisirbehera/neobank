import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AddBeneficiaryRequestSchema,
  MAX_BENEFICIARIES_PER_USER,
} from '@neobank/shared/models';
import {
  AccountNumberPipe,
  applyServerErrors,
  Button,
  Card,
  FormField,
  Input,
  zodValidator,
} from '@neobank/web/ui';
import { BeneficiariesStore } from '../../core/beneficiaries/beneficiaries.store';
import { toApiError } from '../../core/http/api-error';

const fields = AddBeneficiaryRequestSchema.shape;

@Component({
  selector: 'nb-beneficiaries',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Card,
    Button,
    FormField,
    Input,
    AccountNumberPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="h3 mb-4">Beneficiaries</h1>

    <div class="row g-4">
      <div class="col-12 col-lg-5">
        <nb-card title="Add a beneficiary">
          @if (added(); as name) {
            <div class="alert alert-success" role="status">
              {{ name }} was added. You can now send them money.
            </div>
          }
          @if (error(); as error) {
            <div class="alert alert-danger" role="alert">{{ error }}</div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <nb-form-field label="Name">
              <input
                nbInput
                id="beneficiaryName"
                autocomplete="off"
                formControlName="name"
              />
            </nb-form-field>

            <nb-form-field
              label="Account number"
              hint="Their 12-character NeoBank account number, e.g. NB12 3456 7897."
            >
              <input
                nbInput
                id="accountNumber"
                class="font-monospace text-uppercase"
                autocomplete="off"
                spellcheck="false"
                formControlName="accountNumber"
              />
            </nb-form-field>

            <nb-form-field label="Nickname (optional)">
              <input
                nbInput
                id="beneficiaryNickname"
                autocomplete="off"
                formControlName="nickname"
              />
            </nb-form-field>

            <button nbButton type="submit" class="w-100" [loading]="pending()">
              Add beneficiary
            </button>
          </form>
        </nb-card>
      </div>

      <div class="col-12 col-lg-7">
        <nb-card
          title="Your beneficiaries"
          [subtitle]="store.ids().length + ' of ' + max + ' saved'"
        >
          @if (store.error(); as error) {
            <div class="alert alert-danger mb-0">{{ error }}</div>
          } @else if (store.entities().length === 0) {
            <p class="text-body-secondary mb-0">
              No beneficiaries yet. Add someone to send them money.
            </p>
          } @else {
            <ul class="list-group list-group-flush">
              @for (b of store.entities(); track b.id) {
                <li
                  class="list-group-item px-0 d-flex flex-wrap gap-2 justify-content-between align-items-center"
                >
                  <div>
                    <div class="fw-medium">
                      {{ b.name }}
                      @if (b.nickname) {
                        <span class="text-body-secondary fw-normal"
                          >({{ b.nickname }})</span
                        >
                      }
                    </div>
                    <small class="font-monospace text-body-secondary">{{
                      b.accountNumber | accountNumber
                    }}</small>
                  </div>
                  <div class="d-flex gap-2">
                    @if (confirmingId() === b.id) {
                      <button
                        nbButton
                        size="sm"
                        variant="danger"
                        (click)="remove(b.id)"
                      >
                        Confirm remove
                      </button>
                      <button
                        nbButton
                        size="sm"
                        variant="outline-secondary"
                        (click)="confirmingId.set(null)"
                      >
                        Keep
                      </button>
                    } @else {
                      <a
                        nbButton
                        size="sm"
                        routerLink="/transfer"
                        [queryParams]="{ to: b.accountNumber }"
                        >Pay</a
                      >
                      <button
                        nbButton
                        size="sm"
                        variant="outline-secondary"
                        [attr.aria-label]="'Remove ' + b.name"
                        (click)="confirmingId.set(b.id)"
                      >
                        Remove
                      </button>
                    }
                  </div>
                </li>
              }
            </ul>
          }
        </nb-card>
      </div>
    </div>
  `,
})
export class Beneficiaries {
  protected readonly store = inject(BeneficiariesStore);
  protected readonly max = MAX_BENEFICIARIES_PER_USER;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', zodValidator(fields.name)],
    accountNumber: ['', zodValidator(fields.accountNumber)],
    nickname: ['', zodValidator(fields.nickname)],
  });
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly added = signal<string | null>(null);
  protected readonly confirmingId = signal<string | null>(null);

  constructor() {
    void this.store.load();
  }

  async submit(): Promise<void> {
    this.added.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.pending.set(true);
    this.error.set(null);
    try {
      const beneficiary = await this.store.add(this.form.getRawValue());
      this.form.reset();
      this.added.set(beneficiary.name);
    } catch (err) {
      const apiError = toApiError(err);
      applyServerErrors(this.form, apiError.fields);
      if (!apiError.fields) this.error.set(apiError.message);
    } finally {
      this.pending.set(false);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.store.remove(id);
    } catch (err) {
      this.error.set(toApiError(err).message);
    } finally {
      this.confirmingId.set(null);
    }
  }
}
