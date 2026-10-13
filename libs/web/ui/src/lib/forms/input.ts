import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgControl } from '@angular/forms';
import { startWith } from 'rxjs';
import { errorMessage } from './validators';

/**
 * Bootstrap-styled form control that knows its own validation state:
 *   <input nbInput id="email" formControlName="email" />
 * Shows `.is-invalid` once the user has left the field (touched) with an error.
 *
 * On a page built ahead of time, the form is visible before Angular has
 * loaded, so people can type into it. When Angular takes over the page it
 * sets every field to the form's starting value, wiping that text. The text
 * is read here first, and put back into the form.
 */
@Directive({
  selector: 'input[nbInput], select[nbInput], textarea[nbInput]',
  host: {
    '[class.form-control]': '!isSelect',
    '[class.form-select]': 'isSelect',
    '[class.is-invalid]': 'error()',
    '[attr.aria-invalid]': '!!error()',
    '[attr.aria-describedby]': 'error() ? id() + "-error" : null',
  },
})
export class Input implements OnInit {
  readonly id = input.required<string>();

  private readonly ngControl = inject(NgControl, { self: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly element =
    inject<
      ElementRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    >(ElementRef).nativeElement;
  protected readonly isSelect = this.element.tagName === 'SELECT';
  /** Runs before the form control writes its value into the field. */
  private readonly typedEarly =
    isPlatformBrowser(inject(PLATFORM_ID)) && !this.isSelect
      ? this.element.value
      : '';

  /** Error text to show, or null. Read by <nb-form-field>. */
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const control = this.ngControl.control;
    if (!control) return;

    if (this.typedEarly && (control.value ?? '') === '') {
      control.setValue(this.typedEarly);
      control.markAsDirty();
    }

    control.events
      .pipe(startWith(null), takeUntilDestroyed(this.destroyRef))
      .subscribe(() =>
        this.error.set(
          control.invalid && control.touched
            ? errorMessage(control.errors)
            : null,
        ),
      );
  }
}
