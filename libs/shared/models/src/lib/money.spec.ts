import { PaiseSchema, PositivePaiseSchema } from './money';

describe('money schemas', () => {
  it('accepts whole paise', () => {
    expect(PaiseSchema.parse(105000)).toBe(105000);
  });

  it('rejects fractional paise', () => {
    expect(PaiseSchema.safeParse(10.5).success).toBe(false);
  });

  it('rejects zero for positive amounts', () => {
    expect(PositivePaiseSchema.safeParse(0).success).toBe(false);
  });
});
