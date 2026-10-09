import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from './auth.store';
import { session } from './auth.testing';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let store: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
  });

  afterEach(() => backend.verify());

  const signIn = (token: string) =>
    patchState(unprotected(store), {
      accessToken: token,
      user: session().user,
      status: 'authenticated',
    });

  it('adds the bearer token to API calls', () => {
    signIn('access-1');

    http.get('/api/accounts').subscribe();

    const req = backend.expectOne('/api/accounts');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
    req.flush([]);
  });

  it('does not add the token to login/refresh calls', () => {
    signIn('access-1');

    http.post('/api/auth/login', {}).subscribe();

    const req = backend.expectOne('/api/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(session());
  });

  it('refreshes once on 401 and retries with the new token', () => {
    signIn('expired');
    let result: unknown;

    http.get('/api/accounts').subscribe((body) => (result = body));

    backend
      .expectOne('/api/accounts')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/auth/refresh').flush(session('fresh'));

    const retry = backend.expectOne('/api/accounts');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer fresh');
    retry.flush(['ok']);

    expect(result).toEqual(['ok']);
  });

  it('sends the user to /login when the refresh fails', () => {
    signIn('expired');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    http.get('/api/accounts').subscribe({ error: () => undefined });

    backend
      .expectOne('/api/accounts')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne('/api/auth/refresh')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).toHaveBeenCalledWith(['/login'], expect.anything());
    expect(store.isAuthenticated()).toBe(false);
  });
});
