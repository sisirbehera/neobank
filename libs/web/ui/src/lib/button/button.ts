import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'outline-primary'
  | 'outline-secondary'
  | 'link';

export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Attribute component so native button behaviour (type, forms, focus) is kept:
 *   <button nbButton variant="primary" [loading]="saving()">Save</button>
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- attribute selector keeps native <button> semantics
  selector: 'button[nbButton], a[nbButton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    '[attr.disabled]': 'disabled() || loading() ? "" : null',
    '[attr.aria-busy]': 'loading()',
  },
  template: `
    @if (loading()) {
      <span
        class="spinner-border spinner-border-sm me-2"
        aria-hidden="true"
      ></span>
    }
    <ng-content />
  `,
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly loading = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(() => {
    const size = this.size() === 'md' ? '' : ` btn-${this.size()}`;
    return `btn btn-${this.variant()}${size}`;
  });
}
