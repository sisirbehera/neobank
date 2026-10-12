import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { IdleLogoutService } from './idle-logout.service';

/** The "you'll be signed out soon" warning, shown in the last minute. */
@Component({
  selector: 'nb-idle-warning',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (idle.secondsLeft(); as seconds) {
      <div class="modal-backdrop fade show"></div>
      <div
        class="position-fixed top-50 start-50 translate-middle card shadow p-4 nb-idle-warning"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-title"
        aria-describedby="idle-text"
      >
        <h2 id="idle-title" class="h5">Are you still there?</h2>
        <p id="idle-text" class="mb-3">
          For your security, you'll be signed out in
          <strong>{{ seconds }}</strong> seconds.
        </p>
        <button
          #stay
          type="button"
          class="btn btn-primary"
          (click)="idle.touch(true)"
        >
          Stay signed in
        </button>
      </div>
    }
  `,
  styles: `
    .nb-idle-warning {
      z-index: 1060;
      width: min(24rem, calc(100vw - 2rem));
    }
  `,
})
export class IdleWarning {
  protected readonly idle = inject(IdleLogoutService);
  private readonly stay = viewChild<ElementRef<HTMLButtonElement>>('stay');

  constructor() {
    // Move focus to the button when the warning appears, so Enter keeps you in.
    afterRenderEffect(() => this.stay()?.nativeElement.focus());
  }
}
