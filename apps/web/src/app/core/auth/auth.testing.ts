import type { AuthResponse } from '@neobank/shared/models';

/** Test fixture: a signed-in session as returned by the API. */
export const session = (token = 'access-1'): AuthResponse => ({
  accessToken: token,
  user: {
    id: 'u1',
    name: 'Asha Rao',
    email: 'asha@example.com',
    role: 'customer',
    createdAt: new Date().toISOString(),
  },
});
