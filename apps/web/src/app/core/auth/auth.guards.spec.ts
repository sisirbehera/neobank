import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  type RouterStateSnapshot,
} from '@angular/router';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { adminGuard, safeReturnUrl } from './auth.guards';
import { AuthStore } from './auth.store';
import { session } from './auth.testing';

describe('safeReturnUrl', () => {
  it.each([
    ['/dashboard/accounts', '/dashboard/accounts'],
    [undefined, '/dashboard'],
    ['https://evil.example', '/dashboard'],
    ['//evil.example', '/dashboard'],
  ])('%s → %s', (input, expected) => {
    expect(safeReturnUrl(input)).toBe(expected);
  });
});

describe('adminGuard', () => {
  function run(role: 'customer' | 'admin') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const { user, accessToken } = session();
    patchState(unprotected(TestBed.inject(AuthStore)), {
      user: { ...user, role },
      accessToken,
      status: 'authenticated',
    });
    return TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('lets admins in', () => {
    expect(run('admin')).toBe(true);
  });

  it('sends customers to their dashboard', () => {
    expect(String(run('customer'))).toBe('/dashboard');
  });
});
