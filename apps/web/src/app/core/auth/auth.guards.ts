import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

/** Pages for signed-in users. Others go to /login and come back afterwards. */
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return inject(AuthStore).isAuthenticated()
    ? true
    : router.createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url },
      });
};

/** Login/register pages: signed-in users skip straight to the dashboard. */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthStore).isAuthenticated()
    ? router.createUrlTree(['/dashboard'])
    : true;
};

/** Only allow same-site paths, so ?returnUrl= can't redirect to another website. */
export function safeReturnUrl(url: string | null | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//')
    ? url
    : '/dashboard';
}

/** Admin pages. Customers are sent back to their dashboard. */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthStore).isAdmin()
    ? true
    : router.createUrlTree(['/dashboard']);
};
