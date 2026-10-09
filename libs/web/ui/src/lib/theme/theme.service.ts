import {
  computed,
  DOCUMENT,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';

export type ThemeId = 'light' | 'dark' | 'emerald';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  /** Bootstrap colour mode the theme is built on. */
  mode: 'light' | 'dark';
  /** Preview colour shown in the theme picker. */
  swatch: string;
}

export const THEMES: readonly ThemeOption[] = [
  { id: 'light', label: 'Light', mode: 'light', swatch: '#0b5ed7' },
  { id: 'dark', label: 'Dark', mode: 'dark', swatch: '#212529' },
  { id: 'emerald', label: 'Emerald', mode: 'light', swatch: '#0f7b5f' },
];

const STORAGE_KEY = 'nb-theme';

/**
 * Holds the active theme as a signal and mirrors it onto <html>:
 * - data-bs-theme  → Bootstrap light/dark colour mode
 * - data-nb-theme  → our brand palette (see themes.scss)
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly themes = THEMES;
  readonly theme = signal<ThemeId>(this.initialTheme());
  readonly current = computed(
    () => THEMES.find((t) => t.id === this.theme()) ?? THEMES[0],
  );

  constructor() {
    effect(() => {
      const { id, mode } = this.current();
      const root = this.document.documentElement;
      root.setAttribute('data-bs-theme', mode);
      root.setAttribute('data-nb-theme', id);
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // Storage can be unavailable (private mode); the theme still applies.
      }
    });
  }

  setTheme(id: ThemeId): void {
    this.theme.set(id);
  }

  private initialTheme(): ThemeId {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (THEMES.some((t) => t.id === stored)) return stored as ThemeId;
    } catch {
      // ignore
    }
    const prefersDark = this.document.defaultView?.matchMedia?.(
      '(prefers-color-scheme: dark)',
    ).matches;
    return prefersDark ? 'dark' : 'light';
  }
}
