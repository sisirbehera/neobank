import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { ThemeSwitcher } from '@neobank/web/ui';
import { AuthStore } from './core/auth/auth.store';

@Component({
  selector: 'nb-root',
  imports: [RouterOutlet, RouterLink, ThemeSwitcher],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="navbar nb-navbar" data-bs-theme="dark">
      <div class="container flex-wrap gap-2">
        <a class="navbar-brand fw-semibold" routerLink="/">NeoBank</a>

        <div class="d-flex align-items-center flex-wrap gap-2">
          @if (auth.isAuthenticated()) {
            <a class="btn btn-sm btn-link text-white" routerLink="/dashboard"
              >Dashboard</a
            >
            <span class="navbar-text small d-none d-sm-inline">{{
              auth.user()?.name
            }}</span>
            <button
              type="button"
              class="btn btn-sm btn-outline-light"
              (click)="logout()"
            >
              Log out
            </button>
          } @else {
            <a class="btn btn-sm btn-outline-light" routerLink="/login"
              >Log in</a
            >
            <a class="btn btn-sm btn-light" routerLink="/register"
              >Open account</a
            >
          }
          <nb-theme-switcher />
        </div>
      </div>
    </nav>

    <main class="container nb-page">
      <router-outlet />
    </main>

    <footer class="container pb-4 small text-body-secondary">
      Demo application for learning – not a real bank. No real money moves.
    </footer>
  `,
})
export class App {
  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
