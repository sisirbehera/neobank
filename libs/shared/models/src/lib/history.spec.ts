import {
  HistoryQuerySchema,
  UpdateAccountStatusRequestSchema,
} from './history';

describe('HistoryQuerySchema', () => {
  it('treats empty query-string values as not given and applies defaults', () => {
    expect(
      HistoryQuerySchema.parse({ accountId: '', type: '', q: '', page: '2' }),
    ).toEqual({ page: 2, pageSize: 20 });
  });

  it('validates dates and their order', () => {
    expect(HistoryQuerySchema.safeParse({ from: '2026-13-01' }).success).toBe(
      false,
    );
    const reversed = HistoryQuerySchema.safeParse({
      from: '2026-10-09',
      to: '2026-10-01',
    });
    expect(reversed.error?.issues[0].path).toEqual(['to']);
  });

  it('caps the page size', () => {
    expect(HistoryQuerySchema.safeParse({ pageSize: '500' }).success).toBe(
      false,
    );
  });
});

describe('UpdateAccountStatusRequestSchema', () => {
  it('requires a reason and does not allow closing accounts', () => {
    expect(
      UpdateAccountStatusRequestSchema.safeParse({
        status: 'FROZEN',
        reason: '',
      }).success,
    ).toBe(false);
    expect(
      UpdateAccountStatusRequestSchema.safeParse({
        status: 'CLOSED',
        reason: 'Customer asked',
      }).success,
    ).toBe(false);
  });
});
