import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  effect,
  inject,
  Injectable,
  LOCALE_ID,
  PLATFORM_ID,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import {
  type Language,
  LANGUAGE_COOKIE,
  LANGUAGES,
} from '@neobank/shared/models';
import { filter, firstValueFrom, map } from 'rxjs';
import { AuthStore } from '../auth/auth.store';

/** How each language names itself, so people can find their own. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  hi: 'हिन्दी',
};

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/**
 * The app is built once per language (decision record 0013), so each
 * language lives under its own address: /en/dashboard, /hi/dashboard.
 * Switching language is a full page load of the other build; the session
 * survives it (the refresh cookie brings it back).
 *
 * The choice is remembered in the nb_lang cookie (the API reads it to send
 * "/" to the right language) and, for signed-in users, on their profile, so
 * it follows them to other devices. The last explicit choice wins: on a
 * device where a language was chosen, that choice stays; on a device where
 * none was, the profile's language applies after signing in.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly auth = inject(AuthStore);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** The language of this build: "en-IN" → en, "hi" → hi. */
  readonly current: Language = inject(LOCALE_ID).startsWith('hi') ? 'hi' : 'en';

  /**
   * False on the dev server, which serves one language at "/" with no
   * language in the address: there is no other build to switch to.
   */
  readonly switchable = LANGUAGES.some(
    (l) =>
      this.document.querySelector('base')?.getAttribute('href') === `/${l}/`,
  );

  /** The current page's address inside the app, e.g. "/dashboard?page=2". */
  private readonly path = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** The same page in another language, e.g. "/hi/dashboard". */
  hrefFor(language: Language): string {
    return `/${language}${this.path()}`;
  }

  constructor() {
    if (!this.browser || !this.switchable) return;
    // Signed in on a device that never chose a language, while the profile
    // asks for another one: open this page in the profile's language.
    effect(() => {
      const preferred = this.auth.user()?.language;
      if (!preferred || preferred === this.current) return;
      if (this.chosenOnDevice()) return;
      untracked(() => {
        this.rememberOnDevice(preferred);
        this.document.location.assign(this.hrefFor(preferred));
      });
    });
  }

  /** Remembers the choice, then loads the current page in that language. */
  async switchTo(language: Language): Promise<void> {
    this.rememberOnDevice(language);
    const user = this.auth.user();
    // The shared demo login is used by everyone: its profile stays as it is.
    if (user && !user.demo) {
      try {
        await firstValueFrom(this.http.patch('/api/auth/me', { language }));
        this.auth.patchUser({ language });
      } catch {
        // The cookie still applies on this device.
      }
    }
    this.document.location.assign(this.hrefFor(language));
  }

  private chosenOnDevice(): boolean {
    return new RegExp(`(^|; )${LANGUAGE_COOKIE}=`).test(this.document.cookie);
  }

  private rememberOnDevice(language: Language): void {
    this.document.cookie = `${LANGUAGE_COOKIE}=${language}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
  }
}
