import { TestBed } from '@angular/core/testing';
import { ColumnChart, niceMax } from './column-chart';

describe('niceMax', () => {
  it.each([
    [0, 1],
    [7, 10],
    [83, 100],
    [180, 200],
    [2400, 2500],
    [85_000_00, 1_00_00_000],
  ])('%i → %i', (value, expected) => {
    expect(niceMax(value)).toBe(expected);
  });
});

describe('ColumnChart', () => {
  function render() {
    const fixture = TestBed.createComponent(ColumnChart);
    fixture.componentRef.setInput('caption', 'Money in and out');
    fixture.componentRef.setInput('categories', [
      { label: 'Sep', title: 'September 2026' },
      { label: 'Oct', title: 'October 2026' },
    ]);
    fixture.componentRef.setInput('series', [
      { label: 'Money in', values: [100, 200] },
      { label: 'Money out', values: [50, 0] },
    ]);
    fixture.componentRef.setInput('format', (v: number) => `₹${v}`);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('draws one column per non-zero value and a legend', () => {
    const { el } = render();

    const columns = [...el.querySelectorAll('path')].filter((p) =>
      p.getAttribute('d'),
    );
    expect(columns).toHaveLength(3);
    expect(el.textContent).toContain('Money in');
    expect(el.textContent).toContain('Money out');
  });

  it('describes each month for keyboard and screen-reader users', () => {
    const { el } = render();

    const targets = el.querySelectorAll('rect.hit');
    expect(targets[1].getAttribute('aria-label')).toBe(
      'October 2026: Money in ₹200, Money out ₹0',
    );
  });

  it('shows a tooltip with every series on focus', async () => {
    const { fixture, el } = render();

    el.querySelectorAll('rect.hit')[0].dispatchEvent(new Event('focus'));
    await fixture.whenStable();

    const tooltip = el.querySelector('.nb-tooltip');
    expect(tooltip?.textContent).toContain('September 2026');
    expect(tooltip?.textContent).toContain('₹100');
    expect(tooltip?.textContent).toContain('₹50');
  });

  it('offers the same numbers as a table', async () => {
    const { fixture, el } = render();

    (el.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();

    const rows = el.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[1].textContent).toContain('October 2026');
    expect(rows[1].textContent).toContain('₹200');
  });
});
