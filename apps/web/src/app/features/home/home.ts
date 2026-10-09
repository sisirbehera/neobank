import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Amount, Button, Card, InrPipe } from '@neobank/web/ui';
import { SystemStatusStore } from '../../core/system/system-status.store';

@Component({
  selector: 'nb-home',
  imports: [Card, Button, Amount, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-4">
      <h1 class="h3">Welcome to NeoBank</h1>
      <p class="text-body-secondary mb-0">
        Day 1 scaffold – monorepo, API, database and themed UI kit are wired up.
      </p>
    </header>

    <div class="row g-4">
      <div class="col-12 col-lg-5">
        <nb-card title="System status">
          <button
            cardActions
            nbButton
            variant="outline-primary"
            size="sm"
            [loading]="store.loading()"
            (click)="store.load()"
          >
            Refresh
          </button>

          @if (store.error(); as error) {
            <div class="alert alert-danger mb-0" role="alert">{{ error }}</div>
          } @else if (store.health(); as health) {
            <dl class="row mb-0">
              <dt class="col-5">API</dt>
              <dd class="col-7">
                <span class="badge text-bg-success">online</span>
              </dd>
              <dt class="col-5">Database</dt>
              <dd class="col-7">
                <span
                  class="badge"
                  [class.text-bg-success]="store.dbOnline()"
                  [class.text-bg-danger]="!store.dbOnline()"
                  >{{ health.db }}</span
                >
              </dd>
              <dt class="col-5">Uptime</dt>
              <dd class="col-7">{{ health.uptimeSeconds }} s</dd>
              <dt class="col-5">Version</dt>
              <dd class="col-7 mb-0">{{ health.version }}</dd>
            </dl>
          } @else {
            <p class="text-body-secondary mb-0">Checking…</p>
          }
        </nb-card>
      </div>

      <div class="col-12 col-lg-7">
        <nb-card
          title="UI kit preview"
          subtitle="Switch themes from the navbar"
        >
          <div class="d-flex flex-wrap gap-2 mb-3">
            <button nbButton>Primary</button>
            <button nbButton variant="outline-primary">Outline</button>
            <button nbButton variant="secondary">Secondary</button>
            <button nbButton variant="danger">Danger</button>
            <button nbButton loading>Saving</button>
          </div>

          <ul class="list-group mb-3">
            <li class="list-group-item d-flex justify-content-between">
              Salary credited
              <nb-amount [paise]="8500000" signed />
            </li>
            <li class="list-group-item d-flex justify-content-between">
              Rent transfer
              <nb-amount [paise]="-2200000" signed />
            </li>
            <li class="list-group-item d-flex justify-content-between">
              Balance
              <strong>{{ 123456789 | inr }}</strong>
            </li>
          </ul>

          <label class="form-label" for="demo-amount">Amount</label>
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
}
