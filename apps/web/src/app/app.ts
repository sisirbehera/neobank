import {
  afterNextRender,
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
import { LanguageService } from './core/i18n/language.service';
import { LanguageSwitcher } from './core/i18n/language-switcher';
import { ToastService } from './core/toast/toast.service';
import { Toasts } from './core/toast/toasts';

@Component({
  selector: 'nb-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ThemeSwitcher,
    LanguageSwitcher,
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
              i18n
            >
              Log out
            </button>
          } @else {
            <a
              class="btn btn-sm btn-outline-light nb-guest-only"
              routerLink="/login"
              i18n
              >Log in</a
            >
            <a
              class="btn btn-sm btn-light nb-guest-only"
              routerLink="/register"
              i18n
              >Open account</a
            >
          }
          <nb-language-switcher />
          <nb-theme-switcher />
        </div>
      </div>
    </nav>

    <main class="container nb-page">
      <router-outlet />
    </main>

    <footer class="container pb-4 small text-body-secondary" i18n>
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
    // Applies the profile's language after signing in on a new device.
    inject(LanguageService);
    // The session is known now: show signed-out buttons again if they apply
    // (index.html hid them while a session was likely).
    afterNextRender(() =>
      document.documentElement.removeAttribute('data-nb-session'),
    );
  }

  protected readonly links = computed(() => [
    { path: '/dashboard', label: $localize`Dashboard` },
    { path: '/transactions', label: $localize`Transactions` },
    { path: '/transfer', label: $localize`Transfer` },
    { path: '/beneficiaries', label: $localize`Beneficiaries` },
    { path: '/security', label: $localize`Security` },
    ...(this.auth.isAdmin()
      ? [{ path: '/admin', label: $localize`Admin` }]
      : []),
  ]);

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
    this.toasts.info($localize`You're logged out`);
  }
}
