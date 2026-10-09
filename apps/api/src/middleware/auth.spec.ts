import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/http-error';
import { signAccessToken } from '../modules/auth/tokens';
import { TEST_SECRET } from '../test/test-config';
import { requireAuth, requireRole } from './auth';

function run(
  handler: (req: Request, res: Response, next: NextFunction) => void,
  req: Partial<Request>,
) {
  const next = vi.fn();
  handler(req as Request, {} as Response, next);
  return next;
}

const bearer = (token: string) =>
  ({
    get: (name: string) =>
      name.toLowerCase() === 'authorization' ? `Bearer ${token}` : undefined,
  }) as unknown as Partial<Request>;

describe('requireAuth', () => {
  it('sets req.auth for a valid token', () => {
    const token = signAccessToken(
      { sub: 'u1', role: 'admin' },
      TEST_SECRET,
      15,
    );
    const req = bearer(token);

    const next = run(requireAuth(TEST_SECRET), req);

    expect(next).toHaveBeenCalledWith();
    expect(req.auth).toEqual({
      userId: 'u1',
      role: 'admin',
      mfa: false,
      sessionId: '',
    });
  });

  it('rejects an expired token', () => {
    const token = signAccessToken(
      { sub: 'u1', role: 'customer' },
      TEST_SECRET,
      -1,
    );

    const next = run(requireAuth(TEST_SECRET), bearer(token));

    expect(next.mock.calls[0][0]).toMatchObject({ status: 401 });
  });
});

describe('requireRole', () => {
  it('allows a matching role', () => {
    const next = run(requireRole('admin'), {
      auth: { userId: 'u1', role: 'admin', mfa: false, sessionId: '' },
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('forbids other roles', () => {
    const next = run(requireRole('admin'), {
      auth: { userId: 'u1', role: 'customer', mfa: false, sessionId: '' },
    });
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
  });
});
