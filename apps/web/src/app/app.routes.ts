import { Route } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth/auth.guards';

export const appRoutes: Route[] = [
  {
    path: '',
    title: 'NeoBank',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'login',
    title: $localize`:@@title.logIn:Log in · NeoBank`,
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'register',
    title: $localize`:@@title.openAnAccount:Open an account · NeoBank`,
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register').then((m) => m.Register),
  },
  {
    path: 'dashboard',
    title: $localize`:@@title.dashboard:Dashboard · NeoBank`,
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'accounts/new',
    title: $localize`:@@title.openAccount:Open account · NeoBank`,
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/accounts/open-account').then((m) => m.OpenAccount),
  },
  {
    path: 'accounts/:id',
    title: $localize`:@@title.account:Account · NeoBank`,
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/accounts/account-detail').then((m) => m.AccountDetail),
  },
  {
    path: 'transfer',
    title: $localize`:@@title.transfer:Transfer · NeoBank`,
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/transfers/transfer').then((m) => m.Transfer),
  },
  {
    path: 'beneficiaries',
    title: $localize`:@@title.beneficiaries:Beneficiaries · NeoBank`,
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/beneficiaries/beneficiaries').then(
        (m) => m.Beneficiaries,
      ),
  },
  {
    path: 'security',
    title: $localize`:@@title.security:Security · NeoBank`,
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/security/security').then((m) => m.Security),
  },
  {
    path: 'transactions',
    title: $localize`:@@title.transactions:Transactions · NeoBank`,
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/history/history').then((m) => m.History),
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/admin-shell').then((m) => m.AdminShell),
    children: [
      {
        path: '',
        title: 'Admin · NeoBank',
        loadComponent: () =>
          import('./features/admin/admin-overview').then(
            (m) => m.AdminOverview,
          ),
      },
      {
        path: 'users',
        title: 'Users · Admin · NeoBank',
        loadComponent: () =>
          import('./features/admin/admin-users').then((m) => m.AdminUsers),
      },
      {
        path: 'users/:id',
        title: 'User · Admin · NeoBank',
        loadComponent: () =>
          import('./features/admin/admin-user-detail').then(
            (m) => m.AdminUserDetailPage,
          ),
      },
      {
        path: 'transactions',
        title: 'Transactions · Admin · NeoBank',
        loadComponent: () =>
          import('./features/admin/admin-transactions').then(
            (m) => m.AdminTransactions,
          ),
      },
    ],
  },
  {
    path: '**',
    title: $localize`:@@title.pageNotFound:Page not found · NeoBank`,
    loadComponent: () =>
      import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
