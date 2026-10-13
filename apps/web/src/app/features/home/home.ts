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
      <h1 class="h3" i18n="@@home.title">Welcome to NeoBank</h1>
      <p class="text-body-secondary" i18n="@@home.intro">
        A demo digital bank built with Angular, Express and MongoDB.
      </p>
      <div class="d-flex gap-2">
        @if (auth.isAuthenticated()) {
          <a nbButton routerLink="/dashboard" i18n="@@common.goToDashboard"
            >Go to dashboard</a
          >
        } @else {
          <a
            nbButton
            class="nb-guest-only"
            routerLink="/register"
            i18n="@@home.openAnAccount"
            >Open an account</a
          >
          <a
            nbButton
            class="nb-guest-only"
            variant="outline-primary"
            routerLink="/login"
            i18n="@@common.logIn"
            >Log in</a
          >
        }
      </div>
    </header>

    <div class="row g-4">
      <div class="col-12 col-lg-5">
        <nb-card title="System status" i18n-title="@@home.systemStatus">
          <button
            cardActions
            nbButton
            variant="outline-primary"
            size="sm"
            [loading]="store.loading()"
            (click)="store.load()"
            i18n="@@common.refresh"
          >
            Refresh
          </button>

          @if (store.error(); as error) {
            <div class="alert alert-danger mb-0" role="alert">{{ error }}</div>
          } @else if (store.health(); as health) {
            <dl class="row mb-0">
              <dt class="col-5">API</dt>
              <dd class="col-7">
                <span class="badge text-bg-success" i18n="@@home.online"
                  >online</span
                >
              </dd>
              <dt class="col-5" i18n="@@home.database">Database</dt>
              <dd class="col-7">
                <span
                  class="badge"
                  [class.text-bg-success]="store.dbOnline()"
                  [class.text-bg-danger]="!store.dbOnline()"
                  >{{ health.db }}</span
                >
              </dd>
              <dt class="col-5" i18n="@@home.uptime">Uptime</dt>
              <dd class="col-7" i18n="@@home.uptimeSeconds">
                {{ health.uptimeSeconds }} s
              </dd>
              <dt class="col-5" i18n="@@home.version">Version</dt>
              <dd class="col-7 mb-0">{{ health.version }}</dd>
            </dl>
          } @else {
            <p class="text-body-secondary mb-0" i18n="@@home.checking">
              Checking…
            </p>
          }
        </nb-card>
      </div>

      <div class="col-12 col-lg-7">
        <nb-card
          title="UI kit preview"
          i18n-title="@@home.uiKitPreview"
          subtitle="Switch themes from the navbar"
          i18n-subtitle="@@home.uiKitHint"
        >
          <div class="d-flex flex-wrap gap-2 mb-3">
            <button nbButton i18n="@@home.primary">Primary</button>
            <button nbButton variant="outline-primary" i18n="@@home.outline">
              Outline
            </button>
            <button nbButton variant="secondary" i18n="@@home.secondary">
              Secondary
            </button>
            <button nbButton variant="danger" i18n="@@home.danger">
              Danger
            </button>
            <button nbButton loading i18n="@@home.saving">Saving</button>
          </div>

          <ul class="list-group mb-3">
            <li class="list-group-item d-flex justify-content-between">
              <span i18n="@@home.salaryCredited">Salary credited</span>
              <nb-amount [paise]="8500000" signed />
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span i18n="@@home.rentTransfer">Rent transfer</span>
              <nb-amount [paise]="-2200000" signed />
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span i18n="@@home.balance">Balance</span>
              <strong>{{ 123456789 | inr }}</strong>
            </li>
          </ul>

          <label class="form-label" for="demo-amount" i18n="@@common.amount"
            >Amount</label
          >
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
