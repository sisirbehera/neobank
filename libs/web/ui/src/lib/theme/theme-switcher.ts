import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ThemeService } from './theme.service';

@Component({
  selector: 'nb-theme-switcher',
  imports: [NgbDropdownModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div ngbDropdown placement="bottom-end">
      <button
        type="button"
        class="btn btn-sm btn-outline-light"
        ngbDropdownToggle
        aria-label="Change theme"
      >
        <span
          class="nb-swatch"
          [style.background]="themeService.current().swatch"
        ></span>
        {{ themeService.current().label }}
      </button>
      <div ngbDropdownMenu>
        @for (theme of themeService.themes; track theme.id) {
          <button
            type="button"
            ngbDropdownItem
            [class.active]="theme.id === themeService.theme()"
            (click)="themeService.setTheme(theme.id)"
          >
            <span class="nb-swatch" [style.background]="theme.swatch"></span>
            {{ theme.label }}
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    .nb-swatch {
      display: inline-block;
      width: 0.75rem;
      height: 0.75rem;
      margin-right: 0.4rem;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.6);
      vertical-align: -0.05rem;
    }
  `,
})
export class ThemeSwitcher {
  protected readonly themeService = inject(ThemeService);
}
