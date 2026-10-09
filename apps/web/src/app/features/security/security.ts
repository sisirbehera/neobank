import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import { MfaCard } from './mfa-card';
import { PasswordCard } from './password-card';
import { SessionsCard } from './sessions-card';

@Component({
  selector: 'nb-security',
  imports: [MfaCard, PasswordCard, SessionsCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="h3 mb-4">Security</h1>
    <div class="row g-4">
      <div class="col-12 col-lg-6">
        <nb-mfa-card />
      </div>
      <div class="col-12 col-lg-6">
        <nb-password-card (changed)="sessions()?.reload()" />
      </div>
      <div class="col-12">
        <nb-sessions-card />
      </div>
    </div>
  `,
})
export class Security {
  protected readonly sessions = viewChild(SessionsCard);
}
