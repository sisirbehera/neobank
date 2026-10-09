import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  Pipe,
  PipeTransform,
} from '@angular/core';
import { formatInr } from '@neobank/shared/utils';

/** {{ account.balance | inr }} → ₹12,34,567.89 (input is paise). */
@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(paise: number | null | undefined): string {
    return paise == null ? '' : formatInr(paise);
  }
}

/** <nb-amount [paise]="-25000" signed /> → red "-₹250.00" */
@Component({
  selector: 'nb-amount',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'nb-amount',
    style: 'font-variant-numeric: tabular-nums',
    '[class.text-success]': 'signed() && paise() > 0',
    '[class.text-danger]': 'signed() && paise() < 0',
  },
  template: `{{ text() }}`,
})
export class Amount {
  readonly paise = input.required<number>();
  /** Show a +/- sign and colour credits green, debits red. */
  readonly signed = input(false, { transform: booleanAttribute });

  protected readonly text = computed(() => {
    const value = this.paise();
    const formatted = formatInr(Math.abs(value));
    if (value < 0) return `-${formatted}`;
    return this.signed() && value > 0 ? `+${formatted}` : formatted;
  });
}
