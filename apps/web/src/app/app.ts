import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ThemeSwitcher } from '@neobank/web/ui';

@Component({
  selector: 'nb-root',
  imports: [RouterOutlet, RouterLink, ThemeSwitcher],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="navbar nb-navbar" data-bs-theme="dark">
      <div class="container">
        <a class="navbar-brand fw-semibold" routerLink="/">NeoBank</a>
        <nb-theme-switcher />
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
export class App {}
