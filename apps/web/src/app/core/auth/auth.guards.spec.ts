import { safeReturnUrl } from './auth.guards';

describe('safeReturnUrl', () => {
  it.each([
    ['/dashboard/accounts', '/dashboard/accounts'],
    [undefined, '/dashboard'],
    ['https://evil.example', '/dashboard'],
    ['//evil.example', '/dashboard'],
  ])('%s → %s', (input, expected) => {
    expect(safeReturnUrl(input)).toBe(expected);
  });
});
