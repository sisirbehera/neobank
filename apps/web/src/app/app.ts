import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { ThemeSwitcher } from '@neobank/web/ui/theme';
import { AuthStore } from './core/auth/auth.store';
import { IdleLogoutService } from './core/auth/idle-logout.service';
import { IdleWarning } from './core/auth/idle-warning';
import { ToastService } from './core/toast/toast.service';
import { Toasts } from './core/toast/toasts';

@Component({
  selector: 'nb-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ThemeSwitcher,
    Toasts,
    IdleWarning,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="navbar nb-navbar" data-bs-theme="dark">
      <div class="container flex-wrap gap-2">
        <a class="navbar-brand fw-semibold" routerLink="/">NeoBank</a>

        <div class="d-flex align-items-center flex-wrap gap-2">
          @if (auth.isAuthenticated()) {
            @for (link of links(); track link.path) {
              <a
                class="btn btn-sm btn-link text-white text-decoration-none"
                routerLinkActive="fw-semibold text-decoration-underline"
                [routerLink]="link.path"
                >{{ link.label }}</a
              >
            }
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

    <nb-toasts />
    <nb-idle-warning />
  `,
})
export class App {
  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  constructor() {
    // Starts watching for inactivity whenever someone is signed in.
    inject(IdleLogoutService);
  }

  protected readonly links = computed(() => [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/transactions', label: 'Transactions' },
    { path: '/transfer', label: 'Transfer' },
    { path: '/beneficiaries', label: 'Beneficiaries' },
    { path: '/security', label: 'Security' },
    ...(this.auth.isAdmin() ? [{ path: '/admin', label: 'Admin' }] : []),
  ]);

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
    this.toasts.info("You're logged out");
  }
}
