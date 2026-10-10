import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { AuthStore } from '../../core/auth/auth.store';
import { session } from '../../core/auth/auth.testing';
import { Security } from './security';

describe('Security page', () => {
  function render(demo: boolean): HTMLElement {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const { user, accessToken } = session();
    patchState(unprotected(TestBed.inject(AuthStore)), {
      user: { ...user, demo },
      accessToken,
      status: 'authenticated',
    });
    const fixture = TestBed.createComponent(Security);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('offers 2FA and password change on an ordinary account', () => {
    const page = render(false);

    expect(page.querySelector('nb-mfa-card')).not.toBeNull();
    expect(page.querySelector('nb-password-card')).not.toBeNull();
    expect(page.textContent).not.toContain('shared demo account');
  });

  it('explains why the shared demo account cannot change them', () => {
    const page = render(true);

    expect(page.querySelector('nb-mfa-card')).toBeNull();
    expect(page.querySelector('nb-password-card')).toBeNull();
    expect(page.textContent).toContain('This is the shared demo account.');
    expect(page.querySelector('a[href="/register"]')?.textContent?.trim()).toBe(
      'register your own account',
    );
    // The devices list stays: it shows the visitor's own session.
    expect(page.querySelector('nb-sessions-card')).not.toBeNull();
  });
});
