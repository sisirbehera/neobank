import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';

export interface ChartCategory {
  /** Short axis label, e.g. "Oct". */
  label: string;
  /** Full name for tooltips and the table, e.g. "October 2026". */
  title: string;
}

export interface ChartSeries {
  label: string;
  /** One value per category. */
  values: number[];
}

const HEIGHT = 220;
const MARGIN = { top: 22, right: 8, bottom: 26, left: 56 };
const MAX_BAR = 24; // px: thin marks, never fill the band
const BAR_GAP = 2; // px surface gap between neighbouring bars
const RADIUS = 4; // px rounded data-end, square at the baseline

/**
 * Grouped column chart (up to 3 series) in plain SVG.
 *
 * - Colours are validated categorical slots (blue, orange, aqua) with separate
 *   light and dark steps; text always uses text colours, never series colours.
 * - Legend for 2+ series, direct labels only on the last category.
 * - Hover or keyboard-focus a month to see every series in a tooltip.
 * - "Show table" gives the same numbers without relying on colour or hover.
 */
@Component({
  selector: 'nb-column-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center gap-3 mb-2 small">
      @if (series().length > 1) {
        <ul class="list-unstyled d-flex gap-3 mb-0" aria-label="Legend">
          @for (s of series(); track s.label; let i = $index) {
            <li class="d-flex align-items-center gap-1">
              <svg width="12" height="12" aria-hidden="true">
                <rect width="12" height="12" rx="2" [attr.class]="'s' + i" />
              </svg>
              <span class="text-body-secondary">{{ s.label }}</span>
            </li>
          }
        </ul>
      }
      <button
        type="button"
        class="btn btn-link btn-sm p-0 ms-auto"
        (click)="showTable.set(!showTable())"
      >
        {{ showTable() ? 'Show chart' : 'Show table' }}
      </button>
    </div>

    @if (showTable()) {
      <div class="table-responsive">
        <table class="table table-sm mb-0">
          <caption class="visually-hidden">
            {{
              caption()
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              @for (s of series(); track s.label) {
                <th scope="col" class="text-end">{{ s.label }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (c of categories(); track c.title; let ci = $index) {
              <tr>
                <th scope="row" class="fw-normal">{{ c.title }}</th>
                @for (s of series(); track s.label) {
                  <td class="text-end nb-num">
                    {{ format()(s.values[ci]) }}
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="position-relative">
        <svg
          [attr.width]="width()"
          [attr.height]="height"
          role="img"
          [attr.aria-label]="caption()"
          class="d-block"
        >
          <!-- Gridlines + y ticks (recessive) -->
          @for (t of layout().ticks; track t.value) {
            <line
              class="grid"
              [attr.x1]="margin.left"
              [attr.x2]="width() - margin.right"
              [attr.y1]="t.y"
              [attr.y2]="t.y"
            />
            <text
              class="tick"
              [attr.x]="margin.left - 8"
              [attr.y]="t.y"
              text-anchor="end"
              dominant-baseline="middle"
            >
              {{ formatTick()(t.value) }}
            </text>
          }

          @for (g of layout().groups; track g.index) {
            <!-- Hover wash behind the active month -->
            @if (active() === g.index) {
              <rect
                class="wash"
                [attr.x]="g.x0"
                [attr.y]="margin.top"
                [attr.width]="g.width"
                [attr.height]="plotHeight"
              />
            }
            @for (b of g.bars; track b.series) {
              <path [attr.d]="b.path" [attr.class]="'s' + b.series" />
              @if (g.isLast && b.value > 0) {
                <text
                  class="label"
                  [attr.x]="b.cx"
                  [attr.y]="b.top - 6"
                  text-anchor="middle"
                >
                  {{ formatTick()(b.value) }}
                </text>
              }
            }
            <text
              class="tick"
              [attr.x]="g.cx"
              [attr.y]="height - 8"
              text-anchor="middle"
            >
              {{ categories()[g.index]?.label }}
            </text>
            <!-- Hit target: the whole month band, bigger than the bars -->
            <rect
              class="hit"
              tabindex="0"
              [attr.x]="g.x0"
              [attr.y]="margin.top"
              [attr.width]="g.width"
              [attr.height]="plotHeight"
              [attr.aria-label]="g.description"
              (pointerenter)="active.set(g.index)"
              (pointerleave)="active.set(null)"
              (focus)="active.set(g.index)"
              (blur)="active.set(null)"
            />
          }

          <line
            class="axis"
            [attr.x1]="margin.left"
            [attr.x2]="width() - margin.right"
            [attr.y1]="baseline"
            [attr.y2]="baseline"
          />
        </svg>

        @if (tooltip(); as tip) {
          <div
            class="nb-tooltip shadow-sm"
            [style.left.px]="tip.left"
            [style.right.px]="tip.right"
            role="status"
          >
            <div class="small text-body-secondary mb-1">{{ tip.title }}</div>
            @for (row of tip.rows; track row.label; let i = $index) {
              <div class="d-flex align-items-center gap-2">
                <svg width="12" height="4" aria-hidden="true">
                  <rect width="12" height="2" y="1" [attr.class]="'s' + i" />
                </svg>
                <strong class="nb-num">{{ row.value }}</strong>
                <span class="small text-body-secondary">{{ row.label }}</span>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      --nb-series-0: #2a78d6;
      --nb-series-1: #eb6834;
      --nb-series-2: #1baf7a;
      --nb-chart-grid: #e1e0d9;
      --nb-chart-axis: #c3c2b7;
      --nb-chart-muted: #6c6b66;
    }
    :host-context([data-bs-theme='dark']) {
      --nb-series-0: #3987e5;
      --nb-series-1: #d95926;
      --nb-series-2: #199e70;
      --nb-chart-grid: #2c2c2a;
      --nb-chart-axis: #4a4a46;
      --nb-chart-muted: #a3a29a;
    }
    .s0 {
      fill: var(--nb-series-0);
    }
    .s1 {
      fill: var(--nb-series-1);
    }
    .s2 {
      fill: var(--nb-series-2);
    }
    .grid {
      stroke: var(--nb-chart-grid);
      stroke-width: 1;
    }
    .axis {
      stroke: var(--nb-chart-axis);
      stroke-width: 1;
    }
    .tick,
    .label {
      font-size: 11px;
      fill: var(--nb-chart-muted);
      font-variant-numeric: tabular-nums;
    }
    .label {
      fill: var(--bs-secondary-color);
      font-weight: 600;
    }
    .wash {
      fill: var(--bs-tertiary-bg);
    }
    .hit {
      fill: transparent;
      cursor: default;
      outline: none;
    }
    .hit:focus-visible {
      stroke: var(--nb-primary, #0b5ed7);
      stroke-width: 2;
    }
    .nb-num {
      font-variant-numeric: tabular-nums;
    }
    .nb-tooltip {
      position: absolute;
      top: 22px; /* = MARGIN.top */
      pointer-events: none;
      background: var(--bs-body-bg);
      border: 1px solid var(--bs-border-color);
      border-radius: 0.5rem;
      padding: 0.5rem 0.75rem;
      white-space: nowrap;
      z-index: 1;
    }
  `,
})
export class ColumnChart {
  readonly categories = input.required<ChartCategory[]>();
  readonly series = input.required<ChartSeries[]>();
  /** Full value text (tooltip, table), e.g. "₹85,000.00". */
  readonly format = input<(value: number) => string>((v) => String(v));
  /** Compact value text (axis, direct labels), e.g. "₹85K". */
  readonly formatTick = input<(value: number) => string>((v) => String(v));
  /** Accessible summary of what the chart shows. */
  readonly caption = input.required<string>();

  protected readonly height = HEIGHT;
  protected readonly margin = MARGIN;
  protected readonly plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  protected readonly baseline = HEIGHT - MARGIN.bottom;

  protected readonly width = signal(600);
  protected readonly active = signal<number | null>(null);
  protected readonly showTable = signal(false);

  protected readonly layout = computed(() => {
    const series = this.series();
    const n = this.categories().length;
    const plotWidth = this.width() - MARGIN.left - MARGIN.right;
    const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
    const y = (v: number) => this.baseline - (v / max) * this.plotHeight;

    const band = plotWidth / Math.max(n, 1);
    const barWidth = Math.max(
      4,
      Math.min(
        MAX_BAR,
        (band * 0.7 - BAR_GAP * (series.length - 1)) / series.length,
      ),
    );
    const groupWidth = barWidth * series.length + BAR_GAP * (series.length - 1);

    const groups = Array.from({ length: n }, (_, index) => {
      const x0 = MARGIN.left + band * index;
      const start = x0 + (band - groupWidth) / 2;
      const bars = series.map((s, si) => {
        const value = s.values[index] ?? 0;
        const left = start + si * (barWidth + BAR_GAP);
        const top = y(value);
        return {
          series: si,
          value,
          top,
          cx: left + barWidth / 2,
          path: columnPath(left, top, barWidth, this.baseline),
        };
      });
      const title = this.categories()[index]?.title ?? '';
      return {
        index,
        x0,
        width: band,
        cx: x0 + band / 2,
        isLast: index === n - 1,
        bars,
        description: `${title}: ${series
          .map((s) => `${s.label} ${this.format()(s.values[index] ?? 0)}`)
          .join(', ')}`,
      };
    });

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      value: max * f,
      y: y(max * f),
    }));
    return { groups, ticks };
  });

  protected readonly tooltip = computed(() => {
    const index = this.active();
    if (index === null) return null;
    const group = this.layout().groups[index];
    if (!group) return null;
    // Sit beside the hovered month (never on top of the columns being read).
    const onRight = group.cx < this.width() / 2;
    return {
      title: this.categories()[index]?.title ?? '',
      left: onRight ? group.x0 + group.width + 4 : null,
      right: onRight ? null : this.width() - group.x0 + 4,
      rows: this.series().map((s) => ({
        label: s.label,
        value: this.format()(s.values[index] ?? 0),
      })),
    };
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(([entry]) => {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) this.width.set(w);
      });
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}

/** Rounded top corners, square bottom, growing up from the baseline. */
function columnPath(x: number, top: number, w: number, base: number): string {
  const h = base - top;
  if (h <= 0) return '';
  const r = Math.min(RADIUS, w / 2, h);
  return [
    `M${x},${base}`,
    `V${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `H${x + w - r}`,
    `Q${x + w},${top} ${x + w},${top + r}`,
    `V${base}`,
    'Z',
  ].join(' ');
}

/** Rounds the axis maximum up to 1, 2, 2.5 or 5 × a power of ten. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= value) ?? 10;
  return step * power;
}
