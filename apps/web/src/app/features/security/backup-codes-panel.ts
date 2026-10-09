import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { Button } from '@neobank/web/ui';

/** Shows backup codes once, and only continues after the user saved them. */
@Component({
  selector: 'nb-backup-codes-panel',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="alert alert-warning small">
      <strong>Save these backup codes now.</strong> Each one works once if you
      lose your phone. They won't be shown again.
    </div>

    <ul
      class="list-unstyled row row-cols-2 g-2 font-monospace mb-3"
      data-testid="backup-codes"
    >
      @for (code of codes(); track code) {
        <li class="col">
          <span class="border rounded px-2 py-1">{{ code }}</span>
        </li>
      }
    </ul>

    <div class="d-flex flex-wrap gap-2 mb-3">
      <button nbButton size="sm" variant="outline-secondary" (click)="copy()">
        {{ copied() ? 'Copied' : 'Copy' }}
      </button>
      <button
        nbButton
        size="sm"
        variant="outline-secondary"
        (click)="download()"
      >
        Download .txt
      </button>
    </div>

    <div class="form-check mb-3">
      <input
        class="form-check-input"
        type="checkbox"
        id="savedCodes"
        [checked]="saved()"
        (change)="saved.set(!saved())"
      />
      <label class="form-check-label" for="savedCodes">
        I have saved my backup codes
      </label>
    </div>
    <button nbButton [disabled]="!saved()" (click)="done.emit()">
      Continue
    </button>
  `,
})
export class BackupCodesPanel {
  readonly codes = input.required<string[]>();
  readonly done = output<void>();

  protected readonly saved = signal(false);
  protected readonly copied = signal(false);

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.codes().join('\n'));
      this.copied.set(true);
    } catch {
      // Clipboard unavailable: the download button still works.
    }
  }

  download(): void {
    const text = `NeoBank backup codes (each works once)\n\n${this.codes().join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'neobank-backup-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  }
}
