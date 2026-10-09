import { endOfIstDay, istDay, lastIstMonths, startOfIstDay } from './ist';

describe('IST helpers', () => {
  it('uses the Indian calendar day, not UTC', () => {
    // 20:00 UTC on 31 Jan is already 1 Feb in India.
    expect(istDay(new Date('2026-01-31T20:00:00Z'))).toBe('2026-02-01');
  });

  it('gives day boundaries in IST', () => {
    expect(startOfIstDay('2026-10-09').toISOString()).toBe(
      '2026-10-08T18:30:00.000Z',
    );
    expect(endOfIstDay('2026-10-09').toISOString()).toBe(
      '2026-10-09T18:29:59.999Z',
    );
  });

  it('lists the last months across a year boundary', () => {
    expect(lastIstMonths(3, new Date('2026-02-10T00:00:00Z'))).toEqual([
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
});
