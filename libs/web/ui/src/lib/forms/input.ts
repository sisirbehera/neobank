import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  OnInit,
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
  protected readonly isSelect =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName ===
    'SELECT';

  /** Error text to show, or null. Read by <nb-form-field>. */
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const control = this.ngControl.control;
    if (!control) return;

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
