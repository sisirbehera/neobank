import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    title: 'NeoBank',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  { path: '**', redirectTo: '' },
];
