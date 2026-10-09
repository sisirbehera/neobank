import { formatInr, rupeesToPaise } from './money';

describe('formatInr', () => {
  it('uses Indian digit grouping', () => {
    expect(formatInr(123456789)).toBe('₹12,34,567.89');
  });

  it('formats zero', () => {
    expect(formatInr(0)).toBe('₹0.00');
  });
});

describe('rupeesToPaise', () => {
  it('avoids floating point drift', () => {
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(rupeesToPaise(1050.5)).toBe(105050);
  });
});
