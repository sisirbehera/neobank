import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthStore } from './auth.store';
import { session } from './auth.testing';

describe('AuthStore', () => {
  let store: InstanceType<typeof AuthStore>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(AuthStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts in the unknown state', () => {
    expect(store.status()).toBe('unknown');
    expect(store.isAuthenticated()).toBe(false);
  });

  it('stores the session after login', async () => {
    const done = store.login({ email: 'asha@example.com', password: 'x' });
    http.expectOne('/api/auth/login').flush(session());
    await done;

    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe('access-1');
    expect(store.user()?.name).toBe('Asha Rao');
  });

  it('skips the refresh call entirely without the session hint cookie', async () => {
    await store.restoreSession();

    http.expectNone('/api/auth/refresh');
    expect(store.status()).toBe('anonymous');
  });

  it('restores the session when the hint cookie is present', async () => {
    document.cookie = 'nb_session=1';
    const done = store.restoreSession();
    http.expectOne('/api/auth/refresh').flush(session());
    await done;

    expect(store.isAuthenticated()).toBe(true);
    document.cookie = 'nb_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  it('becomes anonymous when the cookie no longer works', async () => {
    document.cookie = 'nb_session=1';
    const done = store.restoreSession();
    document.cookie = 'nb_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    http
      .expectOne('/api/auth/refresh')
      .flush(
        { error: { code: 'SESSION_EXPIRED', message: 'expired' } },
        { status: 401, statusText: 'Unauthorized' },
      );
    await done;

    expect(store.status()).toBe('anonymous');
  });

  it('shares one refresh request between parallel callers', () => {
    const tokens: string[] = [];
    store.refreshAccessToken().subscribe((t) => tokens.push(t));
    store.refreshAccessToken().subscribe((t) => tokens.push(t));

    http.expectOne('/api/auth/refresh').flush(session('access-2'));

    expect(tokens).toEqual(['access-2', 'access-2']);
    expect(store.accessToken()).toBe('access-2');
  });

  it('clears the session on logout even if the request fails', async () => {
    const login = store.login({ email: 'a@b.co', password: 'x' });
    http.expectOne('/api/auth/login').flush(session());
    await login;

    const logout = store.logout();
    http
      .expectOne('/api/auth/logout')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await logout;

    expect(store.isAuthenticated()).toBe(false);
    expect(store.accessToken()).toBeNull();
  });
});
