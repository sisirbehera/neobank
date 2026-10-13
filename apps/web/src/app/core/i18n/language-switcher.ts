import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { type Language, LANGUAGES } from '@neobank/shared/models';
import { LANGUAGE_NAMES, LanguageService } from './language.service';

/**
 * Links to the current page in the other languages. Real links, so they work
 * on a pre-built page before Angular has loaded; once it has, a click also
 * remembers the choice.
 */
@Component({
  selector: 'nb-language-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (service.switchable) {
      @for (option of others; track option.code) {
        <a
          class="btn btn-sm btn-link text-white text-decoration-none"
          [href]="service.hrefFor(option.code)"
          [attr.lang]="option.code"
          [attr.hreflang]="option.code"
          (click)="switch($event, option.code)"
          >{{ option.name }}</a
        >
      }
    }
  `,
})
export class LanguageSwitcher {
  protected readonly service = inject(LanguageService);

  protected readonly others = LANGUAGES.filter(
    (code) => code !== this.service.current,
  ).map((code) => ({ code, name: LANGUAGE_NAMES[code] }));

  protected switch(event: MouseEvent, language: Language): void {
    // Let the browser handle "open in new tab" and similar.
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button) {
      return;
    }
    event.preventDefault();
    void this.service.switchTo(language);
  }
}
