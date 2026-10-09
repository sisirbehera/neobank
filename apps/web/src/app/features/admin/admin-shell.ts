import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'nb-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="d-flex flex-wrap gap-3 justify-content-between align-items-center mb-4"
    >
      <h1 class="h3 mb-0">
        Admin
        <span class="badge text-bg-warning align-middle fs-6">staff only</span>
      </h1>
      <nav class="nav nav-pills">
        @for (tab of tabs; track tab.path) {
          <a
            class="nav-link"
            [routerLink]="tab.path"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: tab.exact }"
            >{{ tab.label }}</a
          >
        }
      </nav>
    </header>
    <router-outlet />
  `,
})
export class AdminShell {
  protected readonly tabs = [
    { path: '/admin', label: 'Overview', exact: true },
    { path: '/admin/users', label: 'Users', exact: false },
    { path: '/admin/transactions', label: 'Transactions', exact: false },
  ];
}
