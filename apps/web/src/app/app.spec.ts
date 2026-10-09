import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { App } from './app';
import { AuthStore } from './core/auth/auth.store';
import { session } from './core/auth/auth.testing';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows log in / open account when signed out', async () => {
    const el = await render();

    expect(el.querySelector('.navbar-brand')?.textContent).toContain('NeoBank');
    expect(el.textContent).toContain('Log in');
    expect(el.textContent).toContain('Open account');
  });

  it('shows the user name and log out when signed in', async () => {
    const { user, accessToken } = session();
    patchState(unprotected(TestBed.inject(AuthStore)), {
      user,
      accessToken,
      status: 'authenticated',
    });

    const el = await render();

    expect(el.textContent).toContain('Asha Rao');
    expect(el.textContent).toContain('Log out');
  });
});
