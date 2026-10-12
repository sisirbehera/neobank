import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Button } from '@neobank/web/ui';
import { AuthStore } from '../../core/auth/auth.store';

/** Any URL the app doesn't know: say so, instead of silently going home. */
@Component({
  selector: 'nb-not-found',
  imports: [RouterLink, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-center py-5">
      <p class="display-4 fw-semibold text-body-secondary mb-2">404</p>
      <h1 class="h3">Page not found</h1>
      <p class="text-body-secondary mb-4">
        There's no page at <code>{{ path }}</code
        >. Check the address, or go back to where you were.
      </p>
      @if (auth.isAuthenticated()) {
        <a nbButton routerLink="/dashboard">Go to dashboard</a>
      } @else {
        <a nbButton routerLink="/">Go to home page</a>
      }
    </div>
  `,
})
export class NotFound {
  protected readonly auth = inject(AuthStore);
  /** The segments the catch-all route matched, i.e. the unknown path. */
  protected readonly path = '/' + inject(ActivatedRoute).snapshot.url.join('/');
}
