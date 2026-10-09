import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Card } from '@neobank/web/ui';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'nb-dashboard',
  imports: [Card, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.user(); as user) {
      <h1 class="h3 mb-4">Hello, {{ user.name }}</h1>

      <div class="row g-4">
        <div class="col-12 col-lg-8">
          <nb-card title="Your accounts">
            <p class="text-body-secondary mb-0">
              Accounts and balances arrive on Day 3.
            </p>
          </nb-card>
        </div>
        <div class="col-12 col-lg-4">
          <nb-card title="Profile">
            <dl class="mb-0">
              <dt>Email</dt>
              <dd>{{ user.email }}</dd>
              <dt>Role</dt>
              <dd class="text-capitalize">{{ user.role }}</dd>
              <dt>Member since</dt>
              <dd class="mb-0">{{ user.createdAt | date: 'mediumDate' }}</dd>
            </dl>
          </nb-card>
        </div>
      </div>
    }
  `,
})
export class Dashboard {
  protected readonly auth = inject(AuthStore);
}
