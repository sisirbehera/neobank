import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { ToastService } from './toast.service';

/**
 * Renders the toasts (Bootstrap's toast styles, no Bootstrap JavaScript).
 * Two live regions: errors interrupt a screen reader, the rest wait their turn.
 * The regions are always on the page (a screen reader only announces changes
 * to a region it already knows), so they carry aria-live but no role: an
 * empty, permanent role="alert" would be found by "the alert on this page".
 */
@Component({
  selector: 'nb-toasts',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-container position-fixed bottom-0 end-0 p-3">
      <div aria-live="assertive" aria-atomic="false">
        @for (t of errors(); track t.id) {
          <ng-container *ngTemplateOutlet="toast; context: { $implicit: t }" />
        }
      </div>
      <div aria-live="polite" aria-atomic="false">
        @for (t of others(); track t.id) {
          <ng-container *ngTemplateOutlet="toast; context: { $implicit: t }" />
        }
      </div>
    </div>

    <ng-template #toast let-t>
      <div
        class="toast show align-items-center border-0 mb-2"
        [class]="'text-bg-' + t.kind"
        data-testid="toast"
        (mouseenter)="service.pause(t.id)"
        (mouseleave)="service.resume(t.id)"
        (focusin)="service.pause(t.id)"
        (focusout)="service.resume(t.id)"
      >
        <div class="d-flex">
          <div class="toast-body">{{ t.text }}</div>
          <button
            type="button"
            class="btn-close me-2 m-auto"
            [class.btn-close-white]="
              t.kind === 'success' || t.kind === 'danger'
            "
            aria-label="Close"
            i18n-aria-label
            (click)="service.dismiss(t.id)"
          ></button>
        </div>
      </div>
    </ng-template>
  `,
})
export class Toasts {
  protected readonly service = inject(ToastService);
  protected readonly errors = computed(() =>
    this.service.toasts().filter((t) => t.kind === 'danger'),
  );
  protected readonly others = computed(() =>
    this.service.toasts().filter((t) => t.kind !== 'danger'),
  );
}
