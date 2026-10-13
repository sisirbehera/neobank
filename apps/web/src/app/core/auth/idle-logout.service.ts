import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../toast/toast.service';
import { AuthStore } from './auth.store';

/** Signed out after this long without a click, key press, scroll or touch. */
export const IDLE_TIMEOUT_MS = 5 * 60_000;
/** A warning with a countdown appears this long before that. */
export const IDLE_WARNING_MS = 60_000;

const STORAGE_KEY = 'nb_last_active';
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
/** Writing on every key press is wasteful; once every few seconds is enough. */
const WRITE_EVERY_MS = 5_000;
const TICK_MS = 1_000;

/**
 * Signs the user out after 5 idle minutes, like a banking app should on a
 * shared or unattended computer.
 *
 * The last-activity time is kept in localStorage (a timestamp, nothing
 * secret), so every open tab sees activity in the others: all tabs share one
 * sign-in, and a forgotten background tab must not end it while the user is
 * busy in another. Comparing timestamps, rather than counting timer ticks,
 * also stays correct when the browser slows timers in hidden tabs or the
 * laptop sleeps.
 *
 * This is a convenience on the client. The server still ends sessions on its
 * own rules (15-minute access tokens, 7-day refresh tokens).
 */
@Injectable({ providedIn: 'root' })
export class IdleLogoutService {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Seconds until sign-out while the warning is showing, otherwise null. */
  readonly secondsLeft = signal<number | null>(null);

  private memoryLastActive = 0;
  private lastWrite = 0;
  private timer?: ReturnType<typeof setInterval>;
  private readonly onActivity = () => this.touch();

  constructor() {
    if (!this.browser) return;
    effect(() => {
      const signedIn = this.auth.isAuthenticated();
      untracked(() => (signedIn ? this.start() : this.stop()));
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Counts as activity now (also used by the "Stay signed in" button). */
  touch(force = false): void {
    const now = Date.now();
    if (!force && now - this.lastWrite < WRITE_EVERY_MS) return;
    this.lastWrite = now;
    this.memoryLastActive = now;
    try {
      localStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      // Storage blocked (private mode, settings): this tab still works alone.
    }
    if (this.secondsLeft() !== null) this.check();
  }

  private start(): void {
    if (this.timer) return;
    this.touch(true);
    for (const type of ACTIVITY_EVENTS) {
      this.document.addEventListener(type, this.onActivity, { passive: true });
    }
    this.timer = setInterval(() => this.check(), TICK_MS);
  }

  private stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    for (const type of ACTIVITY_EVENTS) {
      this.document.removeEventListener(type, this.onActivity);
    }
    this.secondsLeft.set(null);
  }

  private lastActive(): number {
    try {
      const stored = Number(localStorage.getItem(STORAGE_KEY));
      if (stored) return Math.max(stored, this.memoryLastActive);
    } catch {
      // Fall back to this tab's own activity.
    }
    return this.memoryLastActive;
  }

  private check(): void {
    const left = IDLE_TIMEOUT_MS - (Date.now() - this.lastActive());
    if (left <= 0) {
      void this.signOut();
    } else if (left <= IDLE_WARNING_MS) {
      this.secondsLeft.set(Math.ceil(left / 1000));
    } else {
      this.secondsLeft.set(null);
    }
  }

  private async signOut(): Promise<void> {
    this.stop();
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
    this.toasts.info(
      $localize`You were signed out after 5 minutes without activity. Please log in again.`,
    );
  }
}
