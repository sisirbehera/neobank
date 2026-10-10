import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { MfaCard } from './mfa-card';
import { PasswordCard } from './password-card';
import { SessionsCard } from './sessions-card';

@Component({
  selector: 'nb-security',
  imports: [RouterLink, MfaCard, PasswordCard, SessionsCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="h3 mb-4">Security</h1>
    <div class="row g-4">
      @if (demo()) {
        <div class="col-12">
          <div class="alert alert-info mb-0" role="status">
            <strong>This is the shared demo account.</strong>
            Everyone trying NeoBank signs in with it, so its password and
            two-step verification can't be changed, and you only see your own
            session here. To try these features,
            <a routerLink="/register" class="alert-link"
              >register your own account</a
            >.
          </div>
        </div>
      } @else {
        <div class="col-12 col-lg-6">
          <nb-mfa-card />
        </div>
        <div class="col-12 col-lg-6">
          <nb-password-card (changed)="sessions()?.reload()" />
        </div>
      }
      <div class="col-12">
        <nb-sessions-card />
      </div>
    </div>
  `,
})
export class Security {
  private readonly auth = inject(AuthStore);
  protected readonly demo = computed(() => this.auth.user()?.demo ?? false);
  protected readonly sessions = viewChild(SessionsCard);
}
