import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * <nb-card title="Savings" subtitle="NB0012345678">
 *   <button cardActions nbButton size="sm">View</button>
 *   ...body...
 * </nb-card>
 */
@Component({
  selector: 'nb-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-block' },
  template: `
    <section class="card h-100 shadow-sm">
      @if (title()) {
        <header
          class="card-header d-flex align-items-center justify-content-between gap-2"
        >
          <div>
            <h2 class="h6 mb-0">{{ title() }}</h2>
            @if (subtitle()) {
              <small class="text-body-secondary">{{ subtitle() }}</small>
            }
          </div>
          <ng-content select="[cardActions]" />
        </header>
      }
      <div class="card-body">
        <ng-content />
      </div>
    </section>
  `,
})
export class Card {
  readonly title = input<string>();
  readonly subtitle = input<string>();
}
