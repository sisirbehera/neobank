import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  input,
} from '@angular/core';
import { Input } from './input';

/**
 * Label + control + error/hint, in Bootstrap markup:
 *
 *   <nb-form-field label="Email" hint="We never share it">
 *     <input nbInput id="email" type="email" formControlName="email" />
 *   </nb-form-field>
 */
@Component({
  selector: 'nb-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-block mb-3' },
  template: `
    <label class="form-label" [attr.for]="control()?.id()">{{ label() }}</label>
    <ng-content />
    @if (error(); as error) {
      <div class="invalid-feedback d-block" [id]="control()?.id() + '-error'">
        {{ error }}
      </div>
    } @else if (hint()) {
      <div class="form-text">{{ hint() }}</div>
    }
  `,
})
export class FormField {
  readonly label = input.required<string>();
  readonly hint = input<string>();

  protected readonly control = contentChild(Input);
  protected readonly error = computed(() => this.control()?.error() ?? null);
}
