import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import type { AdminUserRow, Page } from '@neobank/shared/models';
import { InrPipe, Input } from '@neobank/web/ui';
import { debounceTime, firstValueFrom } from 'rxjs';
import { AdminApi } from '../../core/admin/admin.api';
import { toApiError } from '../../core/http/api-error';

@Component({
  selector: 'nb-admin-users',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    NgbPagination,
    InrPipe,
    Input,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row mb-3">
      <div class="col-12 col-md-5">
        <label class="form-label small mb-1" for="user-search"
          >Search users</label
        >
        <input
          nbInput
          id="user-search"
          type="search"
          placeholder="Name or email"
          [formControl]="search"
        />
      </div>
    </div>

    @if (error(); as error) {
      <div class="alert alert-danger" role="alert">{{ error }}</div>
    }

    <section class="card shadow-sm">
      <div class="card-body">
        @if (result(); as r) {
          <div class="table-responsive">
            <table class="table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col" class="text-end">Accounts</th>
                  <th scope="col" class="text-end">Total balance</th>
                  <th scope="col" class="d-none d-md-table-cell">Joined</th>
                </tr>
              </thead>
              <tbody>
                @for (u of r.items; track u.id) {
                  <tr>
                    <td>
                      <a [routerLink]="['/admin/users', u.id]">{{ u.name }}</a>
                      @if (u.role === 'admin') {
                        <span class="badge text-bg-secondary ms-1">admin</span>
                      }
                    </td>
                    <td class="small">{{ u.email }}</td>
                    <td class="text-end">{{ u.accountCount }}</td>
                    <td class="text-end text-nowrap">
                      {{ u.totalBalance | inr }}
                    </td>
                    <td class="small d-none d-md-table-cell">
                      {{ u.createdAt | date: 'mediumDate' }}
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="text-body-secondary">
                      No users found.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (r.total > r.pageSize) {
            <ngb-pagination
              class="d-flex justify-content-end mt-3"
              size="sm"
              [collectionSize]="r.total"
              [pageSize]="r.pageSize"
              [page]="r.page"
              [maxSize]="5"
              (pageChange)="load($event)"
            />
          }
        } @else {
          <p class="text-body-secondary mb-0">Loading…</p>
        }
      </div>
    </section>
  `,
})
export class AdminUsers {
  private readonly api = inject(AdminApi);

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly result = signal<Page<AdminUserRow> | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.load(1);
    this.search.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe(() => void this.load(1));
  }

  async load(page: number): Promise<void> {
    try {
      this.result.set(
        await firstValueFrom(this.api.users({ q: this.search.value, page })),
      );
      this.error.set(null);
    } catch (err) {
      this.error.set(toApiError(err).message);
    }
  }
}
