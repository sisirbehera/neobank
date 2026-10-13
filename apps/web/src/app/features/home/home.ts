import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Amount, Button, Card, InrPipe } from '@neobank/web/ui';
import { AuthStore } from '../../core/auth/auth.store';
import { SystemStatusStore } from '../../core/system/system-status.store';

@Component({
  selector: 'nb-home',
  imports: [RouterLink, Card, Button, Amount, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-4">
      <h1 class="h3" i18n>Welcome to NeoBank</h1>
      <p class="text-body-secondary" i18n>
        A demo digital bank built with Angular, Express and MongoDB.
      </p>
      <div class="d-flex gap-2">
        @if (auth.isAuthenticated()) {
          <a nbButton routerLink="/dashboard" i18n>Go to dashboard</a>
        } @else {
          <a nbButton class="nb-guest-only" routerLink="/register" i18n
            >Open an account</a
          >
          <a
            nbButton
            class="nb-guest-only"
            variant="outline-primary"
            routerLink="/login"
            i18n
            >Log in</a
          >
        }
      </div>
    </header>

    <div class="row g-4">
      <div class="col-12 col-lg-5">
        <nb-card title="System status" i18n-title>
          <button
            cardActions
            nbButton
            variant="outline-primary"
            size="sm"
            [loading]="store.loading()"
            (click)="store.load()"
            i18n
          >
            Refresh
          </button>

          @if (store.error(); as error) {
            <div class="alert alert-danger mb-0" role="alert">{{ error }}</div>
          } @else if (store.health(); as health) {
            <dl class="row mb-0">
              <dt class="col-5">API</dt>
              <dd class="col-7">
                <span class="badge text-bg-success" i18n>online</span>
              </dd>
              <dt class="col-5" i18n>Database</dt>
              <dd class="col-7">
                <span
                  class="badge"
                  [class.text-bg-success]="store.dbOnline()"
                  [class.text-bg-danger]="!store.dbOnline()"
                  >{{ health.db }}</span
                >
              </dd>
              <dt class="col-5" i18n>Uptime</dt>
              <dd class="col-7" i18n>{{ health.uptimeSeconds }} s</dd>
              <dt class="col-5" i18n>Version</dt>
              <dd class="col-7 mb-0">{{ health.version }}</dd>
            </dl>
          } @else {
            <p class="text-body-secondary mb-0" i18n>Checking…</p>
          }
        </nb-card>
      </div>

      <div class="col-12 col-lg-7">
        <nb-card
          title="UI kit preview"
          i18n-title
          subtitle="Switch themes from the navbar"
          i18n-subtitle
        >
          <div class="d-flex flex-wrap gap-2 mb-3">
            <button nbButton i18n>Primary</button>
            <button nbButton variant="outline-primary" i18n>Outline</button>
            <button nbButton variant="secondary" i18n>Secondary</button>
            <button nbButton variant="danger" i18n>Danger</button>
            <button nbButton loading i18n>Saving</button>
          </div>

          <ul class="list-group mb-3">
            <li class="list-group-item d-flex justify-content-between">
              <span i18n>Salary credited</span>
              <nb-amount [paise]="8500000" signed />
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span i18n>Rent transfer</span>
              <nb-amount [paise]="-2200000" signed />
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span i18n>Balance</span>
              <strong>{{ 123456789 | inr }}</strong>
            </li>
          </ul>

          <label class="form-label" for="demo-amount" i18n>Amount</label>
          <div class="input-group">
            <span class="input-group-text">₹</span>
            <input
              id="demo-amount"
              class="form-control"
              type="number"
              placeholder="0.00"
            />
          </div>
        </nb-card>
      </div>
    </div>
  `,
})
export class Home {
  protected readonly store = inject(SystemStatusStore);
  protected readonly auth = inject(AuthStore);
}
