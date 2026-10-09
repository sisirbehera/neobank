import { LoginRequestSchema, RegisterRequestSchema } from './auth';

describe('RegisterRequestSchema', () => {
  const valid = {
    name: '  Asha Rao ',
    email: ' Asha@Example.COM ',
    password: 'secret123',
  };

  it('trims the name and normalises the email', () => {
    expect(RegisterRequestSchema.parse(valid)).toEqual({
      name: 'Asha Rao',
      email: 'asha@example.com',
      password: 'secret123',
    });
  });

  it.each([
    ['short', 'at least 8 characters'],
    ['onlyletters', 'must contain a number'],
    ['12345678', 'must contain a letter'],
  ])('rejects weak password %s', (password, message) => {
    const result = RegisterRequestSchema.safeParse({ ...valid, password });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain(message);
  });

  it('rejects an invalid email', () => {
    const result = RegisterRequestSchema.safeParse({ ...valid, email: 'nope' });
    expect(result.error?.issues[0].path).toEqual(['email']);
  });
});

describe('LoginRequestSchema', () => {
  it('does not apply new-password rules', () => {
    expect(
      LoginRequestSchema.safeParse({ email: 'a@b.co', password: 'x' }).success,
    ).toBe(true);
  });
});
