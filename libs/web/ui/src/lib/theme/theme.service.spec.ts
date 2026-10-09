import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('applies the theme to <html> and remembers it', () => {
    const service = TestBed.inject(ThemeService);

    service.setTheme('emerald');
    TestBed.tick();

    const root = document.documentElement;
    expect(root.getAttribute('data-nb-theme')).toBe('emerald');
    expect(root.getAttribute('data-bs-theme')).toBe('light');
    expect(localStorage.getItem('nb-theme')).toBe('emerald');
  });

  it('uses Bootstrap dark mode for the dark theme', () => {
    const service = TestBed.inject(ThemeService);

    service.setTheme('dark');
    TestBed.tick();

    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
  });

  it('restores the saved theme', () => {
    localStorage.setItem('nb-theme', 'emerald');

    expect(TestBed.inject(ThemeService).theme()).toBe('emerald');
  });
});
