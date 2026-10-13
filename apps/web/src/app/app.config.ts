import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import {
  provideClientHydration,
  withEventReplay,
  withI18nSupport,
} from '@angular/platform-browser';
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withPreloading,
} from '@angular/router';
import { registerValidationMessages } from '@neobank/web/ui/messages';
import { ThemeService } from '@neobank/web/ui/theme';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthStore } from './core/auth/auth.store';
import { VALIDATION_MESSAGES } from './core/i18n/messages';
import { stepUpInterceptor } from './core/security/step-up.interceptor';

// Form errors from the shared (English) schemas, in the page's language.
registerValidationMessages(VALIDATION_MESSAGES);

export const appConfig: ApplicationConfig = {
  providers: [
    // Pre-built pages: reuse their HTML instead of re-drawing it, and replay
    // clicks made before the JavaScript arrived. withI18nSupport: without it,
    // components with translated text are drawn again instead of reused.
    provideClientHydration(withEventReplay(), withI18nSupport()),
    provideBrowserGlobalErrorListeners(),
    // After the first page renders, quietly download the other pages so
    // navigating feels instant (they are small: 1–4 KB each, gzipped).
    provideRouter(
      appRoutes,
      withComponentInputBinding(),
      withPreloading(PreloadAllModules),
    ),
    // Order matters: auth adds the token and handles 401s; step-up retries
    // 403 STEP_UP_REQUIRED (the retry still carries the token).
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, stepUpInterceptor]),
    ),
    provideAppInitializer(() => {
      // Apply the saved theme before the first screen renders.
      inject(ThemeService);
      // Restore the session from the refresh cookie before guards run.
      return inject(AuthStore).restoreSession();
    }),
  ],
};
