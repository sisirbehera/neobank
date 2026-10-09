import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import type { AccountDto, AdminUserDetail } from '@neobank/shared/models';
import { AccountNumberPipe, Card, InrPipe } from '@neobank/web/ui';
import { firstValueFrom } from 'rxjs';
import { AdminApi } from '../../core/admin/admin.api';
import { toApiError } from '../../core/http/api-error';
import { ACCOUNT_TYPE_LABELS } from '../accounts/labels';
import { AccountStatusDialog } from './account-status-dialog';

@Component({
  selector: 'nb-admin-user-detail',
  imports: [DatePipe, RouterLink, Card, InrPipe, AccountNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="mb-3 small"><a routerLink="/admin/users">← All users</a></nav>

    @if (error(); as error) {
      <div class="alert alert-danger" role="alert">{{ error }}</div>
    }

    @if (detail(); as d) {
      <div class="row g-4">
        <div class="col-12 col-lg-4">
          <nb-card [title]="d.user.name">
            <dl class="mb-0">
              <dt>Email</dt>
              <dd>{{ d.user.email }}</dd>
              <dt>Role</dt>
              <dd class="text-capitalize">{{ d.user.role }}</dd>
              <dt>Joined</dt>
              <dd class="mb-0">{{ d.user.createdAt | date: 'mediumDate' }}</dd>
            </dl>
          </nb-card>
        </div>
        <div class="col-12 col-lg-8">
          <nb-card title="Accounts">
            @if (d.accounts.length === 0) {
              <p class="text-body-secondary mb-0">No accounts.</p>
            } @else {
              <div class="table-responsive">
                <table class="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Account</th>
                      <th scope="col">Status</th>
                      <th scope="col" class="text-end">Balance</th>
                      <th scope="col">
                        <span class="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (a of d.accounts; track a.id) {
                      <tr>
                        <td>
                          <div>{{ typeLabels[a.type] }}</div>
                          <small class="font-monospace text-body-secondary">{{
                            a.accountNumber | accountNumber
                          }}</small>
                        </td>
                        <td>
                          <span
                            class="badge"
                            [class.text-bg-success]="a.status === 'ACTIVE'"
                            [class.text-bg-warning]="a.status === 'FROZEN'"
                            [class.text-bg-secondary]="a.status === 'CLOSED'"
                            >{{ a.status.toLowerCase() }}</span
                          >
                        </td>
                        <td class="text-end text-nowrap">
                          {{ a.balance | inr }}
                        </td>
                        <td class="text-end">
                          @if (a.status !== 'CLOSED') {
                            <button
                              type="button"
                              class="btn btn-sm"
                              [class.btn-outline-danger]="a.status === 'ACTIVE'"
                              [class.btn-outline-primary]="
                                a.status === 'FROZEN'
                              "
                              (click)="changeStatus(a)"
                            >
                              {{
                                a.status === 'ACTIVE' ? 'Freeze' : 'Unfreeze'
                              }}
                            </button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </nb-card>
        </div>
      </div>
    } @else if (!error()) {
      <p class="text-body-secondary">Loading…</p>
    }
  `,
})
export class AdminUserDetailPage {
  /** Route parameter :id. */
  readonly id = input.required<string>();

  private readonly api = inject(AdminApi);
  private readonly modal = inject(NgbModal);

  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;
  protected readonly detail = signal<AdminUserDetail | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  async changeStatus(account: AccountDto): Promise<void> {
    const ref = this.modal.open(AccountStatusDialog, { centered: true });
    (ref.componentInstance as AccountStatusDialog).setup(account);
    try {
      const updated: AccountDto = await ref.result;
      this.detail.update(
        (d) =>
          d && {
            ...d,
            accounts: d.accounts.map((a) =>
              a.id === updated.id ? updated : a,
            ),
          },
      );
    } catch {
      // Dialog dismissed.
    }
  }

  private async load(id: string): Promise<void> {
    try {
      this.detail.set(await firstValueFrom(this.api.user(id)));
      this.error.set(null);
    } catch (err) {
      this.error.set(toApiError(err).message);
    }
  }
}
