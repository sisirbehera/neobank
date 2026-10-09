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
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withPreloading,
} from '@angular/router';
import { ThemeService } from '@neobank/web/ui/theme';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthStore } from './core/auth/auth.store';
import { stepUpInterceptor } from './core/security/step-up.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
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
