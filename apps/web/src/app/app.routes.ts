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
    title: 'Log in · NeoBank',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'register',
    title: 'Open an account · NeoBank',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register').then((m) => m.Register),
  },
  {
    path: 'dashboard',
    title: 'Dashboard · NeoBank',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'accounts/new',
    title: 'Open account · NeoBank',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/accounts/open-account').then((m) => m.OpenAccount),
  },
  {
    path: 'accounts/:id',
    title: 'Account · NeoBank',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/accounts/account-detail').then((m) => m.AccountDetail),
  },
  {
    path: 'transfer',
    title: 'Transfer · NeoBank',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/transfers/transfer').then((m) => m.Transfer),
  },
  {
    path: 'beneficiaries',
    title: 'Beneficiaries · NeoBank',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/beneficiaries/beneficiaries').then(
        (m) => m.Beneficiaries,
      ),
  },
  {
    path: 'transactions',
    title: 'Transactions · NeoBank',
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
  { path: '**', redirectTo: '' },
];
