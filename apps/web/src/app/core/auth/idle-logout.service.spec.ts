import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { ToastService } from '../toast/toast.service';
import { session } from './auth.testing';
import { AuthStore } from './auth.store';
import {
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MS,
  IdleLogoutService,
} from './idle-logout.service';

describe('IdleLogoutService', () => {
  let idle: IdleLogoutService;
  let auth: InstanceType<typeof AuthStore>;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthStore);
    http = TestBed.inject(HttpTestingController);
    patchState(unprotected(auth), { ...session(), status: 'authenticated' });
    idle = TestBed.inject(IdleLogoutService);
    TestBed.tick(); // runs the effect that starts watching
  });
  afterEach(() => vi.useRealTimers());

  /** Lets the clock run with no user activity. */
  const wait = (ms: number) => vi.advanceTimersByTime(ms);

  it('warns one minute before signing out', () => {
    wait(IDLE_TIMEOUT_MS - IDLE_WARNING_MS - 1000);
    expect(idle.secondsLeft()).toBeNull();

    wait(1000);
    expect(idle.secondsLeft()).toBe(60);

    wait(20_000);
    expect(idle.secondsLeft()).toBe(40);
  });

  it('signs out after 10 idle minutes and says why', async () => {
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    wait(IDLE_TIMEOUT_MS);

    http.expectOne('/api/auth/logout').flush(null);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/login'));
    expect(auth.isAuthenticated()).toBe(false);
    await vi.waitFor(() =>
      expect(TestBed.inject(ToastService).toasts()[0].text).toContain(
        '10 minutes without activity',
      ),
    );
  });

  it('starts again on any key press or click', () => {
    wait(IDLE_TIMEOUT_MS - 30_000);
    expect(idle.secondsLeft()).toBe(30);

    document.dispatchEvent(new KeyboardEvent('keydown'));
    expect(idle.secondsLeft()).toBeNull();

    wait(IDLE_TIMEOUT_MS - IDLE_WARNING_MS - 1000);
    expect(idle.secondsLeft()).toBeNull();
    http.expectNone('/api/auth/logout');
  });

  it('counts activity in another tab', () => {
    wait(IDLE_TIMEOUT_MS - 30_000);
    // Another tab of the same app writes the shared timestamp.
    localStorage.setItem('nb_last_active', String(Date.now()));

    wait(1000);
    expect(idle.secondsLeft()).toBeNull();
  });

  it('stops watching after logging out', () => {
    patchState(unprotected(auth), {
      user: null,
      accessToken: null,
      status: 'anonymous',
    });
    TestBed.tick();

    wait(IDLE_TIMEOUT_MS * 2);
    expect(idle.secondsLeft()).toBeNull();
    http.expectNone('/api/auth/logout');
  });
});
